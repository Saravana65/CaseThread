<#
.SYNOPSIS
    CASETHREAD Evidence Vault Backup Script (Windows PowerShell)
.DESCRIPTION
    Creates a compressed archive of the digital evidence vault volume with individual file SHA-256 manifests.
#>

param (
    [string]$VaultDir = $(if ($env:EVIDENCE_VAULT_PATH) { $env:EVIDENCE_VAULT_PATH } else { "backend/storage/vault" }),
    [string]$OutputDir = "backups/vault"
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "CASETHREAD EVIDENCE VAULT BACKUP UTILITY" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if (-not (Test-Path $VaultDir)) {
    Write-Warning "[NOTICE] Vault directory '$VaultDir' does not exist yet. Creating empty vault."
    New-Item -ItemType Directory -Path $VaultDir -Force | Out-Null
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveFile = Join-Path $OutputDir "vault_backup_${timestamp}.zip"
$manifestFile = "$archiveFile.manifest.json"

# Calculate file hashes before archiving
$files = Get-ChildItem -Path $VaultDir -Recurse -File
$manifestList = @()

foreach ($file in $files) {
    $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
    $relPath = $file.FullName.Substring((Resolve-Path $VaultDir).Path.Length).TrimStart('\', '/')
    $manifestList += @{
        relative_path = $relPath
        size_bytes = $file.Length
        sha256 = $hash
    }
}

Write-Host "[BACKUP] Total Vault Files: $($manifestList.Count)"
Write-Host "[BACKUP] Creating archive: $archiveFile"

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $archiveFile) { Remove-Item $archiveFile -Force }

$sw = [System.Diagnostics.Stopwatch]::StartNew()
[System.IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path $VaultDir).Path, (Join-Path (Get-Location) $archiveFile), [System.IO.Compression.CompressionLevel]::Optimal, $false)
$sw.Stop()

$archiveHash = (Get-FileHash -Path $archiveFile -Algorithm SHA256).Hash
$archiveInfo = Get-Item $archiveFile

@{
    archive_file = [System.IO.Path]::GetFileName($archiveFile)
    timestamp = (Get-Date).ToString("o")
    total_files = $manifestList.Count
    archive_size_bytes = $archiveInfo.Length
    archive_sha256 = $archiveHash
    files = $manifestList
} | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestFile

Write-Host "[SUCCESS] Vault backup completed in $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
Write-Host "[METRICS] Archive Size: $($archiveInfo.Length) bytes"
Write-Host "[INTEGRITY] Archive SHA-256: $archiveHash" -ForegroundColor Yellow
Write-Host "[MANIFEST] Manifest created: $manifestFile"
Write-Host "=================================================================" -ForegroundColor Cyan
