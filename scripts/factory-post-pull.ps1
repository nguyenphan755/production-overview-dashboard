#requires -Version 5.1
<#
.SYNOPSIS
    Sau git pull trên PC nhà máy — một lệnh áp tối ưu hiệu năng (index DB, env, build, PM2).

.DESCRIPTION
    1. Kiểm tra DB + API (check-factory-readiness.mjs)
    2. Bổ sung biến môi trường khuyến nghị (backend/.env, frontend/.env.production)
    3. Tạo performance indexes (CREATE INDEX CONCURRENTLY) + ANALYZE
    4. npm install backend, build frontend với poll chậm hơn
    5. pm2 reload backend (+ nginx reload nếu có)
    6. Kiểm tra lại + benchmark chart (tùy chọn)

.EXAMPLE
    git pull origin main
    powershell -ExecutionPolicy Bypass -File .\scripts\factory-post-pull.ps1

.EXAMPLE
    # Chỉ index + env, không build
    powershell -ExecutionPolicy Bypass -File .\scripts\factory-post-pull.ps1 -SkipBuild

.PARAMETER SkipIndexes
    Bỏ qua migration index (đã chạy rồi).

.PARAMETER SkipBuild
    Bỏ qua npm install / frontend build.

.PARAMETER SkipBenchmark
    Không chạy benchmark-chart-apis.mjs sau deploy.

.PARAMETER DryRunIndexes
    Chỉ in các index sẽ tạo, không DDL.
#>

[CmdletBinding()]
param(
    [switch] $SkipIndexes,
    [switch] $SkipBuild,
    [switch] $SkipBenchmark,
    [switch] $DryRunIndexes,
    [string] $NginxRoot = 'C:\nginx'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ($ProjectRoot -match 'scripts$') {
    $ProjectRoot = Split-Path -Parent $ProjectRoot
}

$BackendDir   = Join-Path $ProjectRoot 'backend'
$FrontendDir  = Join-Path $ProjectRoot 'frontend'
$BackendEnv   = Join-Path $BackendDir '.env'
$FrontendEnv  = Join-Path $FrontendDir '.env.production'
$Pm2AppName   = 'production-dashboard-backend'
$NginxExe     = Join-Path $NginxRoot 'nginx.exe'

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor Cyan
}

function Set-EnvKeyIfMissing([string]$FilePath, [string]$Key, [string]$Value) {
    if (-not (Test-Path $FilePath)) {
        New-Item -ItemType File -Path $FilePath -Force | Out-Null
    }
    $lines = @(Get-Content -Path $FilePath -ErrorAction SilentlyContinue)
    $found = $false
    $newLines = foreach ($line in $lines) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            $found = $true
            $line
        } else {
            $line
        }
    }
    if (-not $found) {
        if ($newLines.Count -gt 0 -and $newLines[-1] -ne '') { $newLines += '' }
        $newLines += "$Key=$Value"
        Set-Content -Path $FilePath -Value $newLines -Encoding UTF8
        Write-Host "  + $Key=$Value" -ForegroundColor Green
        return $true
    }
    Write-Host "  = $Key (unchanged)" -ForegroundColor Gray
    return $false
}

function Require-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js not found. Install Node.js >= 18.'
    }
}

# ---------------------------------------------------------------------------
Write-Step "[0/6] Sanity"
Require-Node
Write-Host "  Project: $ProjectRoot"

if (-not (Test-Path $BackendEnv)) {
    throw "Missing backend/.env — copy .env.example, set DB_PASSWORD and JWT_SECRET, then re-run."
}

# ---------------------------------------------------------------------------
Write-Step "[1/6] Pre-check (DB + API)"
Push-Location $ProjectRoot
try {
    node scripts/check-factory-readiness.mjs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Pre-check reported issues — continuing with fixes..." -ForegroundColor Yellow
    }
} catch {
    Write-Warning "Pre-check failed: $_"
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
Write-Step "[2/6] Recommended env (only adds missing keys)"

$backendChanged = $false
$backendChanged = (Set-EnvKeyIfMissing $BackendEnv 'NODE_ENV' 'production') -or $backendChanged
$backendChanged = (Set-EnvKeyIfMissing $BackendEnv 'AVAILABILITY_SYNC_INTERVAL' '60') -or $backendChanged
$backendChanged = (Set-EnvKeyIfMissing $BackendEnv 'ANALYTICS_REFRESH_INTERVAL' '60') -or $backendChanged

$jwtLine = (Get-Content $BackendEnv -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*JWT_SECRET\s*=' } | Select-Object -First 1)
if ($jwtLine -match 'change_me|your-secret-key-change-in-production' -or -not $jwtLine) {
    Write-Host "  ! JWT_SECRET: set a strong random value in backend/.env before NODE_ENV=production" -ForegroundColor Yellow
}

$frontendChanged = $false
$frontendChanged = (Set-EnvKeyIfMissing $FrontendEnv 'VITE_POLL_MS_MACHINES' '2000') -or $frontendChanged
$frontendChanged = (Set-EnvKeyIfMissing $FrontendEnv 'VITE_POLL_MS_MACHINE_DETAIL' '5000') -or $frontendChanged
$frontendChanged = (Set-EnvKeyIfMissing $FrontendEnv 'VITE_USE_MOCK_DATA' 'false') -or $frontendChanged

if (-not (Test-Path $FrontendEnv) -or -not ((Get-Content $FrontendEnv -Raw) -match 'VITE_API_BASE_URL')) {
    $frontendChanged = (Set-EnvKeyIfMissing $FrontendEnv 'VITE_API_BASE_URL' '/api') -or $frontendChanged
    Write-Host "  (VITE_API_BASE_URL=/api — dùng với nginx. Đổi tay nếu UI gọi API trực tiếp :3001)" -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
Write-Step "[3/6] Performance indexes (CONCURRENTLY)"
if ($SkipIndexes) {
    Write-Host "  Skipped (-SkipIndexes)"
} else {
    Push-Location $ProjectRoot
    try {
        $idxArgs = @('backend/scripts/apply-performance-indexes.mjs')
        if ($DryRunIndexes) { $idxArgs += '--dry-run' }
        & node @idxArgs
        if ($LASTEXITCODE -ne 0) { throw "apply-performance-indexes failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
Write-Step "[4/6] Dependencies + frontend build"
if ($SkipBuild) {
    Write-Host "  Skipped (-SkipBuild)"
} else {
    Push-Location $BackendDir
    try {
        Write-Host "  backend npm install"
        npm install --omit=dev 2>$null
        if ($LASTEXITCODE -ne 0) { npm install }
        if ($LASTEXITCODE -ne 0) { throw "backend npm install failed" }
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Force -Path (Join-Path $BackendDir 'logs') | Out-Null

    if ($frontendChanged -or -not (Test-Path (Join-Path $FrontendDir 'build\index.html'))) {
        Push-Location $FrontendDir
        try {
            Write-Host "  frontend npm install + build (poll env embedded)"
            npm install --legacy-peer-deps
            if ($LASTEXITCODE -ne 0) { throw "frontend npm install failed" }
            npm run build
            if ($LASTEXITCODE -ne 0) { throw "frontend npm run build failed" }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "  Frontend build unchanged (skip — dùng -SkipBuild:$false và sửa .env.production để rebuild)"
    }
}

# ---------------------------------------------------------------------------
Write-Step "[5/6] Restart services"

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing pm2 globally..."
    npm install -g pm2
}

Push-Location $BackendDir
try {
    $pm2List = & pm2 list 2>$null | Out-String
    if ($pm2List -match [regex]::Escape($Pm2AppName)) {
        Write-Host "  pm2 reload $Pm2AppName --update-env"
        pm2 reload ecosystem.config.cjs --update-env
    } else {
        Write-Host "  pm2 start ecosystem.config.cjs"
        pm2 start ecosystem.config.cjs
    }
    if ($LASTEXITCODE -ne 0) { throw "pm2 failed" }
    pm2 save | Out-Null
} finally {
    Pop-Location
}

if (Test-Path $NginxExe) {
    Write-Host "  nginx reload ($NginxRoot)"
    & $NginxExe -p $NginxRoot -s reload 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  nginx not running — start manually or run deploy.ps1" -ForegroundColor Yellow
    }
} else {
    Write-Host "  nginx not at $NginxExe — skip reload" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# ---------------------------------------------------------------------------
Write-Step "[6/6] Post-check"
Push-Location $ProjectRoot
try {
    node scripts/check-factory-readiness.mjs
} finally {
    Pop-Location
}

if (-not $SkipBenchmark) {
    Write-Step "Chart benchmark (dense shift — ~1 min)"
    Push-Location $ProjectRoot
    try {
        node scripts/benchmark-chart-apis.mjs
    } catch {
        Write-Warning "Benchmark failed: $_"
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Done. Factory performance pack applied." -ForegroundColor Green
Write-Host ""
Write-Host "Quick verify:"
Write-Host "  curl http://localhost:3001/health/ready"
Write-Host "  node scripts/check-factory-readiness.mjs"
Write-Host "  node scripts/benchmark-chart-apis.mjs"
Write-Host ""
Write-Host "If charts still slow with many users on Speed Lab 24h+raw:"
Write-Host "  use bucket >= 60s and avoid includeRaw on ranges > 8h."
Write-Host ""

pm2 status 2>$null
