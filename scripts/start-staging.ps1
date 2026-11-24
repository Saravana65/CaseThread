<#
.SYNOPSIS
    CASETHREAD One-Click Staging & Local Production Startup Script (Windows PowerShell)
.DESCRIPTION
    Validates prerequisites, checks database connectivity, ensures native C engine is compiled,
    initializes isolated storage directories, and launches backend API and frontend servers.
#>

param (
    [int]$BackendPort = 5001,
    [int]$FrontendPort = 3000,
    [switch]$SkipFrontend = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "CASETHREAD FORENSIC PLATFORM — STAGING ENVIRONMENT STARTUP" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Verify Node.js
Write-Host "[1/6] Checking Node.js runtime environment..." -ForegroundColor Yellow
$nodeVersion = node -v
Write-Host "      Detected Node.js: $nodeVersion" -ForegroundColor Green

# 2. Verify Native C Core Engine
Write-Host "[2/6] Verifying Native C Engine binary..." -ForegroundColor Yellow
$engineExe = Join-Path $PSScriptRoot "..\core-engine\bin\casethread_engine.exe"
if (-not (Test-Path $engineExe)) {
    Write-Host "      Binary missing at $engineExe. Initiating compilation..." -ForegroundColor Yellow
    Push-Location (Join-Path $PSScriptRoot "..\core-engine")
    if (Get-Command gcc -ErrorAction SilentlyContinue) {
        cmd /c "build.bat"
    } else {
        Write-Warning "GCC not found in PATH. Ensure precompiled casethread_engine binary is present."
    }
    Pop-Location
}
if (Test-Path $engineExe) {
    Write-Host "      Native C binary verified: $engineExe" -ForegroundColor Green
} else {
    Write-Warning "      Native C binary not found; will operate with system fallback."
}

# 3. Ensure Storage Vault Folders Exist
Write-Host "[3/6] Initializing private storage vault boundaries..." -ForegroundColor Yellow
$vaultDir = Join-Path $PSScriptRoot "..\backend\storage\vault"
$kbVaultDir = Join-Path $PSScriptRoot "..\backend\storage\private_knowledge_vault"
if (-not (Test-Path $vaultDir)) { New-Item -ItemType Directory -Path $vaultDir -Force | Out-Null }
if (-not (Test-Path $kbVaultDir)) { New-Item -ItemType Directory -Path $kbVaultDir -Force | Out-Null }
Write-Host "      Evidence Vault:  $vaultDir" -ForegroundColor Green
Write-Host "      Knowledge Vault: $kbVaultDir" -ForegroundColor Green

# 4. Check Database Connectivity
Write-Host "[4/6] Verifying MySQL database connection..." -ForegroundColor Yellow
$dbCheck = node -e "const { testConnection, closePool } = require('./backend/database/connection'); (async () => { const ok = await testConnection(); console.log(ok ? 'OK' : 'FAIL'); await closePool(); })().catch(() => console.log('FAIL'));"
if ($dbCheck -match "OK") {
    Write-Host "      Database connection verified: ONLINE" -ForegroundColor Green
} else {
    Write-Warning "      MySQL connection failed or memory store in effect. Check DB service."
}

# 5. Start Backend Service
Write-Host "[5/6] Launching CaseThread Backend API on port $BackendPort..." -ForegroundColor Yellow
$env:PORT = $BackendPort
$env:NODE_ENV = "staging"
$backendJob = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory (Join-Path $PSScriptRoot "..\backend") -PassThru -WindowStyle Hidden
Set-Content -Path (Join-Path $PSScriptRoot "..\.backend.pid") -Value $backendJob.Id
Write-Host "      Backend started with PID: $($backendJob.Id)" -ForegroundColor Green

# 6. Start Frontend Application
if (-not $SkipFrontend) {
    Write-Host "[6/6] Launching CaseThread React Frontend on port $FrontendPort..." -ForegroundColor Yellow
    $env:PORT = $FrontendPort
    $env:REACT_APP_API_BASE_URL = "http://localhost:$BackendPort/api/v1"
    $frontendJob = Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory (Join-Path $PSScriptRoot "..\frontend") -PassThru -WindowStyle Hidden
    Set-Content -Path (Join-Path $PSScriptRoot "..\.frontend.pid") -Value $frontendJob.Id
    Write-Host "      Frontend started with PID: $($frontendJob.Id)" -ForegroundColor Green
} else {
    Write-Host "[6/6] Skipping frontend launch as requested." -ForegroundColor Gray
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "CASETHREAD STAGING IS READY!" -ForegroundColor Green
Write-Host "Frontend Application: http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "Backend API Service:  http://localhost:$BackendPort/api/v1" -ForegroundColor White
Write-Host "Health Probe:         http://localhost:$BackendPort/api/v1/health" -ForegroundColor White
Write-Host "Readiness Probe:      http://localhost:$BackendPort/api/v1/health/readiness" -ForegroundColor White
Write-Host "Metrics Telemetry:    http://localhost:$BackendPort/api/v1/health/metrics" -ForegroundColor White
Write-Host "To terminate all services, run: .\scripts\stop-staging.ps1" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
