<#
.SYNOPSIS
    CASETHREAD Production Database Backup Script (Windows PowerShell)
.DESCRIPTION
    Creates a consistent logical backup of the CASETHREAD MySQL database using mysqldump.
    Computes SHA-256 integrity hash of the backup file.
#>

param (
    [string]$DbHost = $env:DB_HOST,
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 3306 }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { "root" }),
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { "casethread_db" }),
    [string]$OutputDir = "backups/database"
)

if (-not $DbHost) { $DbHost = "127.0.0.1" }
if (-not $DbPassword) { $DbPassword = $env:MYSQL_ROOT_PASSWORD }

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "CASETHREAD DATABASE BACKUP UTILITY" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# Locate mysqldump binary
$cmd = Get-Command mysqldump -ErrorAction SilentlyContinue
$dumpBin = $null
if ($cmd) {
    $dumpBin = $cmd.Source
}
if (-not $dumpBin) {
    $candidates = @(
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe",
        "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe",
        "C:\xampp\mysql\bin\mysqldump.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $dumpBin = $cand
            break
        }
    }
}

if (-not $dumpBin -or -not (Test-Path $dumpBin)) {
    Write-Error "mysqldump executable could not be found. Please install MySQL client tools or add mysqldump to PATH."
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile = Join-Path $OutputDir "backup_${DbName}_${timestamp}.sql"

Write-Host "[BACKUP] Target Host:     $DbHost`:$DbPort"
Write-Host "[BACKUP] Target Database: $DbName"
Write-Host "[BACKUP] Target User:     $DbUser"
Write-Host "[BACKUP] Destination:     $sqlFile"

$dumpArgs = @(
    "--host=$DbHost",
    "--port=$DbPort",
    "--user=$DbUser",
    "--password=$DbPassword",
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    "--hex-blob",
    "--result-file=$sqlFile",
    $DbName
)

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$process = Start-Process -FilePath $dumpBin -ArgumentList $dumpArgs -NoNewWindow -Wait -PassThru
$sw.Stop()

if ($process.ExitCode -ne 0) {
    Write-Error "[FAILED] mysqldump exited with error code $($process.ExitCode)."
    exit $process.ExitCode
}

$fileInfo = Get-Item $sqlFile
$hash = (Get-FileHash -Path $sqlFile -Algorithm SHA256).Hash

Write-Host "[SUCCESS] Database backup completed in $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
Write-Host "[METRICS] File Size: $($fileInfo.Length) bytes"
Write-Host "[INTEGRITY] SHA-256: $hash" -ForegroundColor Yellow

# Write backup metadata receipt
$metaFile = "$sqlFile.meta.json"
@{
    backup_file = [System.IO.Path]::GetFileName($sqlFile)
    database = $DbName
    timestamp = (Get-Date).ToString("o")
    size_bytes = $fileInfo.Length
    sha256 = $hash
    elapsed_ms = $sw.ElapsedMilliseconds
} | ConvertTo-Json | Set-Content -Path $metaFile

Write-Host "[METADATA] Receipt created: $metaFile"
Write-Host "=================================================================" -ForegroundColor Cyan
