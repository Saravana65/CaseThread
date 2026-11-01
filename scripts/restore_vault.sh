#!/usr/bin/env bash
# ==============================================================================
# CASETHREAD Evidence Vault Restoration Script (POSIX)
# ==============================================================================
set -euo pipefail

ARCHIVE_FILE="${1:-}"
TARGET_DIR="${2:-${EVIDENCE_VAULT_PATH:-backend/storage/vault}}"

if [[ -z "$ARCHIVE_FILE" ]]; then
  echo "Usage: $0 <path_to_archive.tar.gz> [target_directory]"
  exit 1
fi

echo "================================================================="
echo "CASETHREAD EVIDENCE VAULT RESTORATION UTILITY (POSIX)"
echo "================================================================="
echo "[RESTORE] Archive: ${ARCHIVE_FILE}"
echo "[RESTORE] Target:  ${TARGET_DIR}"

mkdir -p "$TARGET_DIR"

START_TIME=$(date +%s%N)
tar -xzf "$ARCHIVE_FILE" -C "$TARGET_DIR"
END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

echo "[SUCCESS] Vault restored successfully in ${ELAPSED_MS}ms"
echo "================================================================="
