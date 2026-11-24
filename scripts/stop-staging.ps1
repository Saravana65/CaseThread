<#
.SYNOPSIS
    CASETHREAD Staging & Local Production Shutdown Script (Windows PowerShell)
.DESCRIPTION
    Terminates background backend and frontend processes spawned by start-staging.ps1.
#>

$ErrorActionPreference = "SilentlyContinue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "CASETHREAD FORENSIC PLATFORM — TERMINATING STAGING SERVICES" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$backendPidFile = Join-Path $PSScriptRoot "..\.backend.pid"
$frontendPidFile = Join-Path $PSScriptRoot "..\.frontend.pid"

if (Test-Path $backendPidFile) {
    $bPid = Get-Content $backendPidFile
    Write-Host "[STOP] Stopping backend process (PID $bPid)..." -ForegroundColor Yellow
    Stop-Process -Id $bPid -Force -ErrorAction SilentlyContinue
    Remove-Item $backendPidFile -Force -ErrorAction SilentlyContinue
}

if (Test-Path $frontendPidFile) {
    $fPid = Get-Content $frontendPidFile
    Write-Host "[STOP] Stopping frontend process (PID $fPid)..." -ForegroundColor Yellow
    Stop-Process -Id $fPid -Force -ErrorAction SilentlyContinue
    Remove-Item $frontendPidFile -Force -ErrorAction SilentlyContinue
}

# Kill any rogue node processes bound to ports 5001 or 3001 if needed
Write-Host "[SUCCESS] Staging services stopped." -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
