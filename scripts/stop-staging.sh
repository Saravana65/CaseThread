#!/usr/bin/env bash
# ==============================================================================
# CASETHREAD Staging & Local Production Shutdown Script (POSIX / Linux / macOS)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "================================================================="
echo "CASETHREAD FORENSIC PLATFORM — TERMINATING STAGING SERVICES"
echo "================================================================="

if [ -f "$ROOT_DIR/.backend.pid" ]; then
    PID=$(cat "$ROOT_DIR/.backend.pid")
    echo "[STOP] Stopping backend process (PID $PID)..."
    kill -TERM "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null || true
    rm -f "$ROOT_DIR/.backend.pid"
fi

if [ -f "$ROOT_DIR/.frontend.pid" ]; then
    PID=$(cat "$ROOT_DIR/.frontend.pid")
    echo "[STOP] Stopping frontend process (PID $PID)..."
    kill -TERM "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null || true
    rm -f "$ROOT_DIR/.frontend.pid"
fi

echo "[SUCCESS] Staging services stopped."
echo "================================================================="
