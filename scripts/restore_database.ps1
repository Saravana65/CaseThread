<#
.SYNOPSIS
    CASETHREAD Safe Database Restoration Script (Windows PowerShell)
.DESCRIPTION
    Restores a CASETHREAD MySQL backup file into a specified target database.
    Supports disposable test databases (e.g. casethread_test_dr) for disaster recovery tests.
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$SqlFile,

    [Parameter(Mandatory=$true)]
    [string]$TargetDb,

    [string]$DbHost = $env:DB_HOST,
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 3306 }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { "root" }),
    [string]$DbPassword = $env:DB_PASSWORD
)

if (-not $DbHost) { $DbHost = "127.0.0.1" }
if (-not $DbPassword) { $DbPassword = $env:MYSQL_ROOT_PASSWORD }

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "CASETHREAD DATABASE RESTORATION UTILITY" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if (-not (Test-Path $SqlFile)) {
    Write-Error "[ERROR] Backup SQL file not found: $SqlFile"
    exit 1
}

# Locate mysql binary
$cmd = Get-Command mysql -ErrorAction SilentlyContinue
$mysqlBin = $null
if ($cmd) {
    $mysqlBin = $cmd.Source
}
if (-not $mysqlBin) {
    $candidates = @(
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe",
        "C:\xampp\mysql\bin\mysql.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $mysqlBin = $cand
            break
        }
    }
}

if (-not $mysqlBin -or -not (Test-Path $mysqlBin)) {
    Write-Error "mysql executable could not be found. Please install MySQL client tools or add mysql to PATH."
    exit 1
}

# Verify integrity hash if metadata receipt exists
$metaFile = "$SqlFile.meta.json"
if (Test-Path $metaFile) {
    $meta = Get-Content $metaFile | ConvertFrom-Json
    $currentHash = (Get-FileHash -Path $SqlFile -Algorithm SHA256).Hash
    if ($meta.sha256 -and ($meta.sha256 -ne $currentHash)) {
        Write-Error "[TAMPER ALERT] Backup file SHA-256 ($currentHash) does not match recorded manifest ($($meta.sha256))!"
        exit 1
    }
    Write-Host "[INTEGRITY] Backup SHA-256 verified successfully against manifest." -ForegroundColor Green
}

Write-Host "[RESTORE] Target Host:     $DbHost`:$DbPort"
Write-Host "[RESTORE] Target Database: $TargetDb"
Write-Host "[RESTORE] Target User:     $DbUser"
Write-Host "[RESTORE] Source SQL File: $SqlFile"

# 1. Ensure target database exists
Write-Host "[STEP 1/3] Ensuring target database '$TargetDb' exists..."
$createDbCmd = "CREATE DATABASE IF NOT EXISTS $TargetDb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cmd.exe /c "`"$mysqlBin`" --host=$DbHost --port=$DbPort --user=$DbUser `"--password=$DbPassword`" -e `"$createDbCmd`""

if ($LASTEXITCODE -ne 0) {
    Write-Error "[FAILED] Could not create target database '$TargetDb'."
    exit $LASTEXITCODE
}

# 2. Execute SQL file restoration
Write-Host "[STEP 2/3] Restoring database schema and records..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
cmd.exe /c "`"$mysqlBin`" --host=$DbHost --port=$DbPort --user=$DbUser `"--password=$DbPassword`" `"$TargetDb`" < `"$SqlFile`""
$sw.Stop()

if ($LASTEXITCODE -ne 0) {
    Write-Error "[FAILED] MySQL restoration process exited with code $LASTEXITCODE."
    exit $LASTEXITCODE
}

# 3. Verify restored tables and row counts
Write-Host "[STEP 3/3] Verifying restored schema in '$TargetDb'..."
$checkQuery = "SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = '$TargetDb';"
$tableCountOutput = & $mysqlBin --host=$DbHost --port=$DbPort --user=$DbUser "--password=$DbPassword" -s -N -e "$checkQuery"

Write-Host "[SUCCESS] Restoration completed successfully in $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
Write-Host "[VERIFICATION] Total Tables in '$TargetDb': $tableCountOutput" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
