#!/usr/bin/env bash
# ==============================================================================
# CASETHREAD Evidence Vault Backup Script (POSIX)
# ==============================================================================
set -euo pipefail

VAULT_DIR="${EVIDENCE_VAULT_PATH:-backend/storage/vault}"
OUTPUT_DIR="${OUTPUT_DIR:-backups/vault}"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_FILE="${OUTPUT_DIR}/vault_backup_${TIMESTAMP}.tar.gz"

echo "================================================================="
echo "CASETHREAD EVIDENCE VAULT BACKUP UTILITY (POSIX)"
echo "================================================================="

if [[ ! -d "$VAULT_DIR" ]]; then
  echo "[NOTICE] Creating empty vault directory: $VAULT_DIR"
  mkdir -p "$VAULT_DIR"
fi

START_TIME=$(date +%s%N)
tar -czf "$ARCHIVE_FILE" -C "$VAULT_DIR" .
END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

ARCHIVE_SIZE=$(wc -c < "$ARCHIVE_FILE")
ARCHIVE_HASH=$(sha256sum "$ARCHIVE_FILE" | awk '{print $1}')

echo "[SUCCESS] Vault backup completed in ${ELAPSED_MS}ms"
echo "[METRICS] Archive Size: ${ARCHIVE_SIZE} bytes"
echo "[INTEGRITY] SHA-256: ${ARCHIVE_HASH}"

cat <<EOF > "${ARCHIVE_FILE}.meta.json"
{
  "archive_file": "$(basename "$ARCHIVE_FILE")",
  "timestamp": "$(date -Iseconds)",
  "size_bytes": $ARCHIVE_SIZE,
  "sha256": "$ARCHIVE_HASH",
  "elapsed_ms": $ELAPSED_MS
}
EOF

echo "[METADATA] Receipt created: ${ARCHIVE_FILE}.meta.json"
echo "================================================================="
