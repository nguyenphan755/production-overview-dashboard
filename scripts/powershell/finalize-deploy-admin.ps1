#requires -Version 5.1
<#
.SYNOPSIS
    Finalize Production Overview Dashboard deploy on Windows port 80.

.DESCRIPTION
    Run this script in PowerShell elevated as Administrator. It will:
      1. Stop and disable IIS (W3SVC + WAS) so port 80 is free.
      2. Stop any leftover NGINX / PM2 daemons from previous runs.
      3. Call deploy.ps1 with -InstallAutoStart -OpenFirewall.
      4. Smoke test http://localhost/health and http://localhost/api/machines.
      5. Print a summary and listen-port snapshot.

    Output is captured via Start-Transcript so you can re-read it later.
    Exit code mirrors the deploy result so it can be polled programmatically.

.PARAMETER ProjectRoot
    Repo root. Default: parent of parent of this script.

.PARAMETER LogFile
    Transcript path. Default: <ProjectRoot>\scripts\powershell\finalize-deploy-admin.log
#>

[CmdletBinding()]
param(
    [string] $ProjectRoot,
    [string] $LogFile
)

if (-not $ProjectRoot) {
    # Script lives at <root>\scripts\powershell\finalize-deploy-admin.ps1, so
    # we need three Split-Path -Parent calls to reach <root>.
    $ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition))
}
if (-not $LogFile) {
    $LogFile = Join-Path $ProjectRoot 'scripts\powershell\finalize-deploy-admin.log'
}

# Ensure log dir exists, then start transcript
$logDir = Split-Path -Parent $LogFile
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

try { Stop-Transcript | Out-Null } catch { }
Start-Transcript -Path $LogFile -Force | Out-Null

$ErrorActionPreference = 'Continue'   # keep running so transcript captures everything
$failed = $false

function Write-Section([string]$Msg) {
    Write-Host ""
    Write-Host "############################################################" -ForegroundColor Cyan
    Write-Host "## $Msg" -ForegroundColor Cyan
    Write-Host "############################################################" -ForegroundColor Cyan
}

Write-Section "Sanity check"
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
$isAdmin = $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "User    : $($id.Name)"
Write-Host "IsAdmin : $isAdmin"
Write-Host "Project : $ProjectRoot"
Write-Host "Log     : $LogFile"

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 2
}

Set-Location $ProjectRoot

Write-Section "[1/5] Stop and disable IIS (W3SVC + WAS)"
foreach ($svcName in @('W3SVC','WAS')) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -eq 'Running') {
            Write-Host "  Stopping $svcName..."
            Stop-Service -Name $svcName -Force -ErrorAction Continue
        } else {
            Write-Host "  $svcName already $($svc.Status)"
        }
        Set-Service -Name $svcName -StartupType Disabled -ErrorAction Continue
        $svcAfter = Get-Service -Name $svcName
        Write-Host "  $svcName -> Status=$($svcAfter.Status) StartType=$($svcAfter.StartType)"
    } else {
        Write-Host "  $svcName not present (skip)"
    }
}

Write-Section "[2/5] Cleanup leftover nginx / pm2"
$nginxExe = 'C:\nginx\nginx.exe'
if (Test-Path $nginxExe) {
    & $nginxExe -p 'C:\nginx' -s quit 2>$null
    Start-Sleep -Seconds 2
}
Get-Process nginx -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Killing nginx pid=$($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
# Kill stale pm2 daemon if any (avoids weird state)
& pm2 kill 2>&1 | Out-Null
Start-Sleep -Seconds 1

Write-Section "[3/5] Run deploy.ps1 -InstallAutoStart -OpenFirewall"
$deployScript = Join-Path $ProjectRoot 'deploy.ps1'
if (-not (Test-Path $deployScript)) {
    Write-Host "ERROR: deploy.ps1 not found at $deployScript" -ForegroundColor Red
    $failed = $true
} else {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deployScript -InstallAutoStart -OpenFirewall
    $deployExit = $LASTEXITCODE
    Write-Host "deploy.ps1 exit code: $deployExit"
    if ($deployExit -ne 0) { $failed = $true }
}

Write-Section "[4/5] Smoke test on port 80"
Start-Sleep -Seconds 3

function Test-Url([string]$Url, [int]$Timeout = 10) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $Timeout
        $preview = if ($r.Content.Length -gt 200) { $r.Content.Substring(0,200) + '...' } else { $r.Content }
        Write-Host ("OK  {0}  status={1}  bytes={2}" -f $Url, $r.StatusCode, $r.RawContentLength)
        Write-Host ("    body : {0}" -f ($preview -replace '\s+',' '))
        return $true
    } catch {
        Write-Host ("FAIL {0}  -> {1}" -f $Url, $_.Exception.Message) -ForegroundColor Red
        return $false
    }
}

$ok1 = Test-Url 'http://localhost/health'                5
$ok2 = Test-Url 'http://localhost/api/machines'         15
$ok3 = Test-Url 'http://localhost/'                      5
if (-not ($ok1 -and $ok2 -and $ok3)) { $failed = $true }

Write-Section "[5/5] Final state snapshot"
Write-Host ""
Write-Host "-- Listeners on 80 / 3001 --"
Get-NetTCPConnection -LocalPort 80, 3001 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
        $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        "port {0,-5} pid={1,-6} proc={2}" -f $_.LocalPort, $_.OwningProcess, $p.ProcessName
    }

Write-Host ""
Write-Host "-- IIS services --"
Get-Service W3SVC, WAS -ErrorAction SilentlyContinue |
    Format-Table Name, Status, StartType -AutoSize | Out-String | Write-Host

Write-Host "-- Auto-start scheduled tasks --"
Get-ScheduledTask -TaskName 'ProductionDashboard-*' -ErrorAction SilentlyContinue |
    Format-Table TaskName, State -AutoSize | Out-String | Write-Host

Write-Host ""
Write-Host "-- pm2 list --"
pm2 list 2>&1 | Out-String | Write-Host

Write-Host ""
Write-Host "-- nginx procs --"
Get-Process nginx -ErrorAction SilentlyContinue |
    Format-Table Id, ProcessName, StartTime -AutoSize | Out-String | Write-Host

Write-Section "DONE"
if ($failed) {
    Write-Host "RESULT: FAIL - see log above" -ForegroundColor Red
} else {
    $serverIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                 Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
                 Select-Object -First 1 -ExpandProperty IPAddress)
    if (-not $serverIp) { $serverIp = '<server-ip>' }
    Write-Host "RESULT: SUCCESS - Dashboard at http://$serverIp/" -ForegroundColor Green
}

Stop-Transcript | Out-Null
if ($failed) { exit 1 } else { exit 0 }
