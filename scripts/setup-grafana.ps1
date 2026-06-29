# MES Grafana — cài tự động một lệnh (Windows)
# Chạy từ thư mục gốc repo (cần Docker Desktop + Node.js)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "MES Grafana setup — repo: $Root" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js chưa cài. Tải từ https://nodejs.org"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker chưa cài hoặc chưa chạy. Mở Docker Desktop rồi thử lại."
}

# Chuyển tham số dòng lệnh cho script Node (vd. --db-host 192.168.1.10)
$nodeArgs = @("scripts/setup-grafana.mjs") + $args
node @nodeArgs

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
