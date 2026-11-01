#!/usr/bin/env bash
# ==============================================================================
# CASETHREAD Safe Database Restoration Script (Linux / POSIX)
# ==============================================================================
set -euo pipefail

SQL_FILE="${1:-}"
TARGET_DB="${2:-}"

if [[ -z "$SQL_FILE" || -z "$TARGET_DB" ]]; then
  echo "Usage: $0 <path_to_sql_file> <target_database_name>"
  exit 1
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}"

echo "================================================================="
echo "CASETHREAD DATABASE RESTORATION UTILITY (POSIX)"
echo "================================================================="
echo "[RESTORE] Source File:    ${SQL_FILE}"
echo "[RESTORE] Target DB:      ${TARGET_DB}"
echo "[RESTORE] Target Host:    ${DB_HOST}:${DB_PORT}"

# Verify checksum if manifest receipt is available
META_FILE="${SQL_FILE}.meta.json"
if [[ -f "$META_FILE" ]]; then
  RECORDED_HASH=$(grep '"sha256":' "$META_FILE" | sed -E 's/.*"sha256": "([^"]+)".*/\1/')
  CURRENT_HASH=$(sha256sum "$SQL_FILE" | awk '{print $1}')
  if [[ "$RECORDED_HASH" != "$CURRENT_HASH" ]]; then
    echo "[TAMPER ALERT] File hash ${CURRENT_HASH} does not match recorded ${RECORDED_HASH}!"
    exit 1
  fi
  echo "[INTEGRITY] SHA-256 verified successfully against manifest."
fi

# Ensure target database exists
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restore SQL dump
START_TIME=$(date +%s%N)
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" \
  "$TARGET_DB" < "$SQL_FILE"
END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

TABLE_COUNT=$(mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" -s -N \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${TARGET_DB}';")

echo "[SUCCESS] Restoration completed in ${ELAPSED_MS}ms"
echo "[VERIFICATION] Total Tables in ${TARGET_DB}: ${TABLE_COUNT}"
echo "================================================================="
