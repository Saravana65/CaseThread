#!/usr/bin/env bash
# ==============================================================================
# CASETHREAD One-Click Staging & Local Production Startup Script (POSIX / Linux / macOS)
# ==============================================================================

set -e

BACKEND_PORT=${PORT:-5001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "================================================================="
echo "CASETHREAD FORENSIC PLATFORM — STAGING ENVIRONMENT STARTUP"
echo "================================================================="

# 1. Verify Node.js
echo "[1/6] Checking Node.js runtime environment..."
node -v

# 2. Verify Native C Core Engine
echo "[2/6] Verifying Native C Engine binary..."
ENGINE_BIN="$ROOT_DIR/core-engine/bin/casethread_engine"
if [ ! -f "$ENGINE_BIN" ]; then
    echo "      Compiling native C engine..."
    (cd "$ROOT_DIR/core-engine" && make clean && make all && strip bin/casethread_engine && chmod +x bin/casethread_engine)
fi
echo "      Native C binary verified: $ENGINE_BIN"

# 3. Ensure Storage Vault Folders Exist
echo "[3/6] Initializing private storage vault boundaries..."
mkdir -p "$ROOT_DIR/backend/storage/vault" "$ROOT_DIR/backend/storage/private_knowledge_vault"
echo "      Evidence Vault:  $ROOT_DIR/backend/storage/vault"
echo "      Knowledge Vault: $ROOT_DIR/backend/storage/private_knowledge_vault"

# 4. Check Database Connectivity
echo "[4/6] Verifying MySQL database connection..."
node -e "const { testConnection, closePool } = require('$ROOT_DIR/backend/database/connection'); (async () => { const ok = await testConnection(); console.log(ok ? 'Database verified: ONLINE' : 'WARN: Database offline'); await closePool(); })().catch(console.error);"

# 5. Start Backend Service
echo "[5/6] Launching CaseThread Backend API on port $BACKEND_PORT..."
PORT=$BACKEND_PORT NODE_ENV=staging node "$ROOT_DIR/backend/server.js" > "$ROOT_DIR/backend.log" 2>&1 &
echo $! > "$ROOT_DIR/.backend.pid"
echo "      Backend started with PID $(cat "$ROOT_DIR/.backend.pid")"

# 6. Start Frontend Application
echo "[6/6] Launching CaseThread React Frontend on port $FRONTEND_PORT..."
(cd "$ROOT_DIR/frontend" && PORT=$FRONTEND_PORT npm start) > "$ROOT_DIR/frontend.log" 2>&1 &
echo $! > "$ROOT_DIR/.frontend.pid"
echo "      Frontend started with PID $(cat "$ROOT_DIR/.frontend.pid")"

echo "================================================================="
echo "CASETHREAD STAGING IS READY!"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT/api/v1"
echo "Health:   http://localhost:$BACKEND_PORT/api/v1/health"
echo "================================================================="
