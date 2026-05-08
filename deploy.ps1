#requires -Version 5.1
<#
.SYNOPSIS
    Production Overview Dashboard - Windows deploy script (PM2 + NGINX).

.DESCRIPTION
    Idempotent deploy for a Windows server. Steps:
      1. Build the Vite frontend with VITE_API_BASE_URL=/api so the browser
         talks to NGINX on port 80 instead of the backend on port 3001.
      2. Install backend dependencies, ensure logs/ folder.
      3. Start (or reload) the backend under PM2 using
         backend/ecosystem.config.cjs and pm2 save.
      4. Render infrastructure/nginx/app.conf into
         <NginxRoot>/conf/production-dashboard.conf with the absolute path
         to frontend/build, install a known-good nginx.conf that includes
         it, then reload (or start) NGINX.
      5. Optional: register Task Scheduler tasks so NGINX starts at system
         boot and PM2 resurrects the saved process list at user logon.
      6. Optional: open Windows Firewall TCP 80.

.PARAMETER NginxRoot
    Folder where NGINX is installed. Default: C:\nginx

.PARAMETER InstallAutoStart
    Register two Scheduled Tasks (requires Administrator):
      - ProductionDashboard-NGINX : runs nginx.exe at boot as SYSTEM
      - ProductionDashboard-PM2   : runs `pm2 resurrect` at user logon
    Native Windows replacement for the buggy `pm2-windows-service` package
    (which prompts interactively and tends to hang in unattended scripts).

.PARAMETER OpenFirewall
    Add a Windows Firewall rule allowing inbound TCP 80 (requires admin).

.PARAMETER SkipFrontendBuild
    Skip `npm install` + `npm run build` for the frontend (use existing
    frontend/build).

.PARAMETER SkipBackendInstall
    Skip `npm install` for the backend.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\deploy.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -InstallAutoStart -OpenFirewall
#>

[CmdletBinding()]
param(
    [string] $NginxRoot          = 'C:\nginx',
    [switch] $InstallAutoStart,
    [switch] $OpenFirewall,
    [switch] $SkipFrontendBuild,
    [switch] $SkipBackendInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor Cyan
}

function Write-Info([string]$Message) {
    Write-Host "  $Message" -ForegroundColor Gray
}

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Require-Command([string]$Name, [string]$Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name. $Hint"
    }
}

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
$ProjectRoot   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$FrontendDir   = Join-Path $ProjectRoot 'frontend'
$FrontendDist  = Join-Path $FrontendDir 'build'
$BackendDir    = Join-Path $ProjectRoot 'backend'
$NginxTemplate = Join-Path $ProjectRoot 'infrastructure\nginx\app.conf'
$EcosystemFile = Join-Path $BackendDir 'ecosystem.config.cjs'
$Pm2AppName    = 'production-dashboard-backend'

$NginxConfDir       = Join-Path $NginxRoot 'conf'
$NginxAppConfTarget = Join-Path $NginxConfDir 'production-dashboard.conf'
$NginxMainConf      = Join-Path $NginxConfDir 'nginx.conf'
$NginxExe           = Join-Path $NginxRoot 'nginx.exe'

# ---------------------------------------------------------------------------
# Sanity
# ---------------------------------------------------------------------------
Write-Step "[0/5] Sanity checks"

if (-not (Test-Admin)) {
    Write-Warning "Not running as Administrator. Some steps may fail (firewall, service install)."
}

Require-Command 'node' 'Install Node.js >= 18 from https://nodejs.org/'
Require-Command 'npm'  'npm should ship with Node.js'

if (-not (Test-Path $NginxExe)) {
    throw "NGINX not found at $NginxExe. Install nginx for Windows from http://nginx.org/en/download.html and extract to $NginxRoot, or pass -NginxRoot <path>."
}
if (-not (Test-Path $NginxTemplate)) {
    throw "NGINX template not found: $NginxTemplate"
}
if (-not (Test-Path $EcosystemFile)) {
    throw "PM2 ecosystem config not found: $EcosystemFile"
}

Write-Info "Project root  : $ProjectRoot"
Write-Info "Frontend dist : $FrontendDist"
Write-Info "NGINX root    : $NginxRoot"

# ---------------------------------------------------------------------------
# 1) Frontend build (Vite -> frontend/build) with relative API URL
# ---------------------------------------------------------------------------
Write-Step "[1/5] Build frontend"

if ($SkipFrontendBuild) {
    Write-Info "Skipped (-SkipFrontendBuild). Using existing $FrontendDist."
    if (-not (Test-Path (Join-Path $FrontendDist 'index.html'))) {
        throw "Frontend not built yet: $FrontendDist\index.html missing."
    }
} else {
    # .env.production is loaded by Vite only for production builds and overrides
    # the values in .env. Using /api makes the SPA call NGINX on the same origin.
    $envProdPath = Join-Path $FrontendDir '.env.production'
    @(
        'VITE_API_BASE_URL=/api',
        'VITE_USE_MOCK_DATA=false',
        'VITE_REALTIME_ENABLED=false'
    ) | Set-Content -Path $envProdPath -Encoding ASCII

    Push-Location $FrontendDir
    try {
        Write-Info "npm install"
        npm install
        if ($LASTEXITCODE -ne 0) { throw "frontend npm install failed (exit $LASTEXITCODE)" }

        Write-Info "npm run build"
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "frontend npm run build failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path (Join-Path $FrontendDist 'index.html'))) {
        throw "Frontend build produced no index.html in $FrontendDist."
    }
}

# ---------------------------------------------------------------------------
# 2) Backend deps
# ---------------------------------------------------------------------------
Write-Step "[2/5] Install backend dependencies"

if ($SkipBackendInstall) {
    Write-Info "Skipped (-SkipBackendInstall)."
} else {
    Push-Location $BackendDir
    try {
        Write-Info "npm install"
        npm install --omit=dev
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "npm install --omit=dev failed (exit $LASTEXITCODE), retrying without flag"
            npm install
            if ($LASTEXITCODE -ne 0) { throw "backend npm install failed (exit $LASTEXITCODE)" }
        }
    } finally {
        Pop-Location
    }
}
New-Item -ItemType Directory -Force -Path (Join-Path $BackendDir 'logs') | Out-Null

# Make sure pm2 is installed globally (idempotent)
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Info "PM2 not found - installing globally via npm"
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) { throw "npm install -g pm2 failed (exit $LASTEXITCODE)" }
}

# ---------------------------------------------------------------------------
# 3) PM2: start or reload backend
# ---------------------------------------------------------------------------
Write-Step "[3/5] Start backend with PM2 ($Pm2AppName)"

Push-Location $BackendDir
try {
    # Detect existing PM2 app via grep on `pm2 list` text output.
    # Avoids the "doesn't exist" stderr warning from `pm2 describe` and
    # avoids strict-mode pitfalls with empty `pm2 jlist` JSON.
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $pm2List = & pm2 list 2>$null | Out-String
    $ErrorActionPreference = $prevPref
    $global:LASTEXITCODE = 0

    $existing = $false
    if ($pm2List -and ($pm2List -match [regex]::Escape($Pm2AppName))) {
        $existing = $true
    }

    if ($existing) {
        Write-Info "App already exists - reloading"
        pm2 reload ecosystem.config.cjs --update-env
    } else {
        Write-Info "App not found - starting"
        pm2 start ecosystem.config.cjs
    }
    if ($LASTEXITCODE -ne 0) { throw "pm2 start/reload failed (exit $LASTEXITCODE)" }

    pm2 save | Out-Null
} finally {
    Pop-Location
}

if ($InstallAutoStart) {
    Write-Step "    Register auto-start scheduled tasks"
    if (-not (Test-Admin)) {
        Write-Warning "Auto-start setup requires Administrator. Skipping."
    } else {
        # 1) NGINX at system boot, running as SYSTEM
        $nginxAction    = New-ScheduledTaskAction `
            -Execute $NginxExe `
            -WorkingDirectory $NginxRoot
        $nginxTrigger   = New-ScheduledTaskTrigger -AtStartup
        $nginxPrincipal = New-ScheduledTaskPrincipal `
            -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $nginxSettings  = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -StartWhenAvailable
        Register-ScheduledTask -TaskName 'ProductionDashboard-NGINX' `
            -Description 'Auto-start NGINX for Production Overview Dashboard' `
            -Action $nginxAction -Trigger $nginxTrigger `
            -Principal $nginxPrincipal -Settings $nginxSettings `
            -Force | Out-Null
        Write-Info "Scheduled task registered: ProductionDashboard-NGINX (AtStartup, SYSTEM)"

        # 2) PM2 resurrect at logon of the current user (so it picks up the
        #    saved dump.pm2 from this user's PM2 home dir).
        $pm2Cmd       = 'powershell.exe'
        $pm2Args      = '-NoProfile -ExecutionPolicy Bypass -Command "pm2 resurrect"'
        $pm2Action    = New-ScheduledTaskAction -Execute $pm2Cmd -Argument $pm2Args
        $pm2Trigger   = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $pm2Principal = New-ScheduledTaskPrincipal `
            -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
        Register-ScheduledTask -TaskName 'ProductionDashboard-PM2' `
            -Description 'Resurrect PM2 processes (Production Overview Dashboard)' `
            -Action $pm2Action -Trigger $pm2Trigger `
            -Principal $pm2Principal `
            -Force | Out-Null
        Write-Info "Scheduled task registered: ProductionDashboard-PM2 (AtLogOn, $env:USERNAME)"
    }
}

# ---------------------------------------------------------------------------
# 4) NGINX config + reload
# ---------------------------------------------------------------------------
Write-Step "[4/5] Render and install NGINX config"

# Use forward slashes for nginx (cross-platform, avoids backslash escape issues)
$FrontendDistFwd = $FrontendDist -replace '\\', '/'

$template = Get-Content -Path $NginxTemplate -Raw
$rendered = $template -replace '__FRONTEND_DIST__', $FrontendDistFwd

# Write app config (LF line endings to keep nginx happy and diffs clean)
$rendered = $rendered -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($NginxAppConfTarget, $rendered, (New-Object System.Text.UTF8Encoding $false))
Write-Info "Wrote $NginxAppConfTarget"

# Backup existing nginx.conf once, then write a known-good main config that
# includes production-dashboard.conf. Re-running deploy.ps1 leaves the
# original .bak intact.
if (Test-Path $NginxMainConf) {
    $backup = "$NginxMainConf.bak"
    if (-not (Test-Path $backup)) {
        Copy-Item $NginxMainConf $backup
        Write-Info "Backed up original nginx.conf -> $backup"
    }
}

$mainConf = @'
# Auto-generated by deploy.ps1 - safe to edit, but a re-run preserves the
# original copy at nginx.conf.bak.

worker_processes  auto;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    tcp_nopush    on;
    keepalive_timeout 65;

    # Production Overview Dashboard
    include       production-dashboard.conf;
}
'@
$mainConf = $mainConf -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($NginxMainConf, $mainConf, (New-Object System.Text.UTF8Encoding $false))
Write-Info "Wrote $NginxMainConf"

# ---------------------------------------------------------------------------
# 5) Validate + start/reload NGINX
# ---------------------------------------------------------------------------
Write-Step "[5/5] Test and start/reload NGINX"

# Always invoke nginx with -p so it resolves relative paths (logs/, conf/)
# correctly even when called from another working directory.
& $NginxExe -p $NginxRoot -t
if ($LASTEXITCODE -ne 0) { throw "nginx -t failed (exit $LASTEXITCODE). Check the config above." }

$nginxRunning = @(Get-Process -Name nginx -ErrorAction SilentlyContinue)
if ($nginxRunning.Count -gt 0) {
    Write-Info "NGINX already running (pids: $(($nginxRunning | ForEach-Object Id) -join ', ')) - reloading"
    & $NginxExe -p $NginxRoot -s reload
    if ($LASTEXITCODE -ne 0) { throw "nginx -s reload failed (exit $LASTEXITCODE)" }
} else {
    Write-Info "Starting NGINX in background"
    Start-Process -FilePath $NginxExe -WorkingDirectory $NginxRoot -WindowStyle Hidden
    Start-Sleep -Seconds 1
    $running = @(Get-Process -Name nginx -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) {
        throw "NGINX did not start. Check $NginxRoot\logs\error.log."
    }
    Write-Info "NGINX started (pids: $(($running | ForEach-Object Id) -join ', '))"
}

# ---------------------------------------------------------------------------
# Optional: open firewall
# ---------------------------------------------------------------------------
if ($OpenFirewall) {
    Write-Step "    Open Windows Firewall TCP 80"
    if (-not (Test-Admin)) {
        Write-Warning "Opening firewall requires Administrator. Skipping."
    } else {
        $rule = Get-NetFirewallRule -DisplayName 'Production Dashboard HTTP 80' -ErrorAction SilentlyContinue
        if (-not $rule) {
            New-NetFirewallRule `
                -DisplayName 'Production Dashboard HTTP 80' `
                -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 | Out-Null
            Write-Info "Firewall rule added"
        } else {
            Write-Info "Firewall rule already present"
        }
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$serverIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
             Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
             Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $serverIp) { $serverIp = '<server-ip>' }

Write-Host ""
Write-Host "Done. Dashboard: " -NoNewline
Write-Host "http://$serverIp/" -ForegroundColor Green
Write-Host ""
Write-Host "  - Frontend  : served by NGINX from $FrontendDist"
Write-Host "  - REST API  : proxied to 127.0.0.1:3001 under /api"
Write-Host "  - WebSocket : proxied to 127.0.0.1:3001 under /ws"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  pm2 status"
Write-Host "  pm2 logs $Pm2AppName"
Write-Host "  & '$NginxExe' -p '$NginxRoot' -t"
Write-Host "  & '$NginxExe' -p '$NginxRoot' -s reload"
Write-Host "  & '$NginxExe' -p '$NginxRoot' -s quit"
Write-Host ""

pm2 status
