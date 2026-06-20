#!/usr/bin/env bash
# Team Delta — Platform Engineer
# Build a self-contained Linux package for Doc Template Studio.
#
# Downloads python-build-standalone, installs all Python packages,
# builds the React frontend, and tars everything into:
#   dist/doc-template-studio-linux.tar.gz
#
# Usage:
#   chmod +x scripts/build_package.sh
#   ./scripts/build_package.sh
#   ./scripts/build_package.sh --python-version 3.11.9 --py-date 20240814
#
# NOTE: WeasyPrint (PDF export) requires system libraries on the target machine:
#   Debian/Ubuntu:  sudo apt install libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0
#   Fedora/RHEL:    sudo dnf install pango cairo gdk-pixbuf2

set -euo pipefail

PYTHON_VERSION="3.11.9"
PY_DATE="20240814"   # python-build-standalone release tag

# Parse optional flags
while [[ $# -gt 0 ]]; do
    case "$1" in
        --python-version) PYTHON_VERSION="$2"; shift 2 ;;
        --py-date)        PY_DATE="$2";        shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT/build-tmp"
DIST_DIR="$ROOT/dist"
PKG_NAME="doc-template-studio"
PKG_DIR="$BUILD_DIR/$PKG_NAME"

echo ""
echo "=== Doc Template Studio — Linux Package Builder ==="
echo "    Python $PYTHON_VERSION ($PY_DATE)  |  Output: dist/doc-template-studio-linux.tar.gz"
echo ""

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
echo "[1/6] Checking prerequisites..."
for cmd in node npm curl tar; do
    command -v "$cmd" >/dev/null || { echo "ERROR: $cmd not found. Install it and re-run."; exit 1; }
done
echo "      node $(node --version)  npm $(npm --version)"

# ── 2. Build frontend ─────────────────────────────────────────────────────────
echo "[2/6] Building React frontend..."
cd "$ROOT/frontend"
npm install --legacy-peer-deps --prefer-offline --quiet
npm run build --silent
cd "$ROOT"
echo "      Frontend built to backend/static/"

# ── 3. Prepare package directory ──────────────────────────────────────────────
echo "[3/6] Assembling package directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$PKG_DIR/backend"

# Copy backend source, excluding dev/runtime dirs
cp -a "$ROOT/backend/." "$PKG_DIR/backend/"
rm -rf \
    "$PKG_DIR/backend/venv" \
    "$PKG_DIR/backend/__pycache__" \
    "$PKG_DIR/backend/.pytest_cache" \
    "$PKG_DIR/backend/data" \
    "$PKG_DIR/backend/uploads" \
    "$PKG_DIR/backend/exports"

# Create empty runtime dirs
mkdir -p "$PKG_DIR/backend/data" "$PKG_DIR/backend/uploads" "$PKG_DIR/backend/exports"
echo "      Backend source copied"

# ── 4. Bundle portable Python ─────────────────────────────────────────────────
echo "[4/6] Bundling Python $PYTHON_VERSION (python-build-standalone)..."

PY_ARCHIVE="cpython-${PYTHON_VERSION}+${PY_DATE}-x86_64-unknown-linux-gnu-install_only.tar.gz"
PY_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PY_DATE}/${PY_ARCHIVE}"

mkdir -p "$BUILD_DIR"
echo "      Downloading $PY_ARCHIVE..."
curl -L --progress-bar -o "$BUILD_DIR/python-linux.tar.gz" "$PY_URL"

echo "      Extracting..."
mkdir -p "$PKG_DIR/python-linux"
tar -xzf "$BUILD_DIR/python-linux.tar.gz" -C "$PKG_DIR/python-linux" --strip-components=1

echo "      Installing Python packages (this may take a minute)..."
"$PKG_DIR/python-linux/bin/pip3" install \
    -r "$ROOT/backend/requirements.txt" \
    --quiet
echo "      Python packages installed"

# ── 5. Add launcher ───────────────────────────────────────────────────────────
echo "[5/6] Adding run.sh launcher..."
cp "$ROOT/run.sh" "$PKG_DIR/run.sh"
chmod +x "$PKG_DIR/run.sh"
echo "      Done"

# ── 6. Create archive ─────────────────────────────────────────────────────────
echo "[6/6] Creating distribution archive..."
mkdir -p "$DIST_DIR"
ARCHIVE="$DIST_DIR/doc-template-studio-linux.tar.gz"
tar -czf "$ARCHIVE" -C "$BUILD_DIR" "$PKG_NAME"
echo "      Created: dist/doc-template-studio-linux.tar.gz"

# Cleanup
rm -rf "$BUILD_DIR"

SIZE=$(du -sh "$ARCHIVE" | cut -f1)
echo ""
echo "=== Done! dist/doc-template-studio-linux.tar.gz  ($SIZE) ==="
echo ""
echo "Distribute that archive. Recipients:"
echo "  1. tar -xzf doc-template-studio-linux.tar.gz"
echo "  2. cd doc-template-studio"
echo "  3. ./run.sh"
echo "  4. Browser opens at http://localhost:8000"
echo ""
echo "WeasyPrint system libs needed for PDF export:"
echo "  Debian/Ubuntu: sudo apt install libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0"
echo "  Fedora/RHEL:   sudo dnf install pango cairo gdk-pixbuf2"
echo ""
