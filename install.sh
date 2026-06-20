#!/usr/bin/env bash
# Doc Template Studio — bare-metal Linux installer
# Usage: chmod +x install.sh && ./install.sh
# Starts the app on http://localhost:8000

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "==> Checking dependencies..."
command -v python3 >/dev/null || { echo "ERROR: python3 not found"; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found"; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm not found"; exit 1; }

# ── Frontend build ─────────────────────────────────────────────────────────────
echo "==> Building frontend..."
cd "$FRONTEND_DIR"
npm ci --legacy-peer-deps
npm run build

# ── Backend venv + deps ────────────────────────────────────────────────────────
echo "==> Setting up Python virtual environment..."
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

# WeasyPrint system deps hint
if ! python3 -c "import weasyprint" 2>/dev/null; then
  echo ""
  echo "NOTE: WeasyPrint needs system libraries for PDF export."
  echo "  Debian/Ubuntu: sudo apt-get install -y libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0 fonts-liberation"
  echo "  RHEL/Fedora:   sudo dnf install pango cairo gdk-pixbuf2 liberation-fonts"
  echo ""
fi

mkdir -p uploads exports data

echo ""
echo "==> Starting Doc Template Studio on http://localhost:8000"
echo "     Press Ctrl+C to stop."
echo ""
DATABASE_URL=sqlite:///./data/templates.sqlite \
  STATIC_DIR=static \
  UPLOAD_DIR=uploads \
  EXPORT_DIR=exports \
  ALLOWED_ORIGINS=http://localhost:8000 \
  venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
