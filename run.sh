#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PYTHON="./python-linux/bin/python3"
PORT=8000

if [ ! -f "$PYTHON" ]; then
    echo "ERROR: Bundled Python not found at python-linux/bin/python3"
    echo "Please run scripts/build_package.sh first to create the distribution package,"
    echo "or extract the full doc-template-studio-linux.tar.gz which includes python-linux/."
    exit 1
fi

# WeasyPrint requires system libraries; check for the most common one.
if ! python3 -c "import ctypes; ctypes.CDLL('libpango-1.0.so.0')" 2>/dev/null; then
    echo "WARNING: libpango not found. PDF export may fail."
    echo "Install with: sudo apt install libpango-1.0-0   (Debian/Ubuntu)"
    echo "              sudo dnf install pango             (Fedora/RHEL)"
    echo ""
fi

echo "================================================"
echo " Doc Template Studio"
echo " http://localhost:$PORT"
echo " Press Ctrl+C to stop the server"
echo "================================================"
echo ""

# Create runtime dirs in case they were deleted
mkdir -p backend/data backend/uploads backend/exports

# Open browser after 3-second delay (best-effort, non-blocking)
if command -v xdg-open &>/dev/null; then
    (sleep 3 && xdg-open "http://localhost:$PORT") &
elif command -v open &>/dev/null; then
    (sleep 3 && open "http://localhost:$PORT") &
fi

# Start uvicorn using bundled Python; --app-dir adds backend/ to sys.path
"$PYTHON" -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port "$PORT"
