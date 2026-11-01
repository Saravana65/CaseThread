<#
.SYNOPSIS
    CASETHREAD Evidence Vault Restoration & Integrity Verification Script (Windows PowerShell)
.DESCRIPTION
    Extracts a vault archive into target vault directory and validates 100% cryptographic SHA-256 match.
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$ArchiveFile,

    [string]$TargetVaultDir = $(if ($env:EVIDENCE_VAULT_PATH) { $env:EVIDENCE_VAULT_PATH } else { "backend/storage/vault" })
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "CASETHREAD EVIDENCE VAULT RESTORATION UTILITY" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if (-not (Test-Path $ArchiveFile)) {
    Write-Error "[ERROR] Archive file not found: $ArchiveFile"
    exit 1
}

$manifestFile = "$ArchiveFile.manifest.json"
if (-not (Test-Path $manifestFile)) {
    Write-Warning "[WARN] Manifest file '$manifestFile' not found. Will extract without pre-manifest validation."
}

if (-not (Test-Path $TargetVaultDir)) {
    New-Item -ItemType Directory -Path $TargetVaultDir -Force | Out-Null
}

Write-Host "[RESTORE] Extracting $ArchiveFile into $TargetVaultDir..."
Add-Type -AssemblyName System.IO.Compression.FileSystem

$resolvedTarget = (Resolve-Path $TargetVaultDir).Path
$resolvedArchive = (Resolve-Path $ArchiveFile).Path

$sw = [System.Diagnostics.Stopwatch]::StartNew()
[System.IO.Compression.ZipFile]::ExtractToDirectory($resolvedArchive, $resolvedTarget)
$sw.Stop()

Write-Host "[SUCCESS] Extraction completed in $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green

# Verify integrity against manifest
if (Test-Path $manifestFile) {
    Write-Host "[VERIFICATION] Validating SHA-256 integrity of all restored files against manifest..."
    $manifest = Get-Content $manifestFile | ConvertFrom-Json
    $matched = 0
    $mismatched = 0

    foreach ($expected in $manifest.files) {
        $fullPath = Join-Path $TargetVaultDir $expected.relative_path
        if (-not (Test-Path $fullPath)) {
            Write-Error "[MISSING] Restored file missing on disk: $($expected.relative_path)"
            $mismatched++
            continue
        }
        $actualHash = (Get-FileHash -Path $fullPath -Algorithm SHA256).Hash
        if ($actualHash -eq $expected.sha256) {
            $matched++
        } else {
            Write-Error "[CORRUPT] Hash mismatch for $($expected.relative_path)! Expected: $($expected.sha256), Got: $actualHash"
            $mismatched++
        }
    }

    Write-Host "[INTEGRITY REPORT] Matched: $matched | Mismatched: $mismatched" -ForegroundColor $(if ($mismatched -eq 0) { "Green" } else { "Red" })
    if ($mismatched -gt 0) {
        exit 1
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
