#!/usr/bin/env bash
# ==============================================================================
# CASETHREAD Production Database Backup Script (Linux / POSIX)
# ==============================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}"
DB_NAME="${DB_NAME:-casethread_db}"
OUTPUT_DIR="${OUTPUT_DIR:-backups/database}"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SQL_FILE="${OUTPUT_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql"

echo "================================================================="
echo "CASETHREAD DATABASE BACKUP UTILITY (POSIX)"
echo "================================================================="
echo "[BACKUP] Host:        ${DB_HOST}:${DB_PORT}"
echo "[BACKUP] Database:    ${DB_NAME}"
echo "[BACKUP] Destination: ${SQL_FILE}"

START_TIME=$(date +%s%N)

mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --hex-blob \
  --result-file="$SQL_FILE" \
  "$DB_NAME"

END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

FILE_SIZE=$(wc -c < "$SQL_FILE")
SHA256=$(sha256sum "$SQL_FILE" | awk '{print $1}')

echo "[SUCCESS] Backup completed in ${ELAPSED_MS}ms"
echo "[METRICS] File Size: ${FILE_SIZE} bytes"
echo "[INTEGRITY] SHA-256: ${SHA256}"

cat <<EOF > "${SQL_FILE}.meta.json"
{
  "backup_file": "$(basename "$SQL_FILE")",
  "database": "$DB_NAME",
  "timestamp": "$(date -Iseconds)",
  "size_bytes": $FILE_SIZE,
  "sha256": "$SHA256",
  "elapsed_ms": $ELAPSED_MS
}
EOF

echo "[METADATA] Receipt created: ${SQL_FILE}.meta.json"
echo "================================================================="
