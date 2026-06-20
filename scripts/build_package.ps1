#Requires -Version 5.1
<#
.SYNOPSIS
    Build a self-contained Windows package for Doc Template Studio.

.DESCRIPTION
    Team Delta — DevOps Lead
    Downloads Python 3.11 embeddable, installs pip + all requirements,
    builds the React frontend, copies backend source, and zips everything
    into dist\doc-template-studio-win.zip.

    The resulting zip is fully self-contained: extract it anywhere and
    double-click run.bat. No Python, Node, or Docker required on the
    target machine.

.PARAMETER PythonVersion
    Python version to bundle (default: 3.11.9).

.PARAMETER Port
    Port the app will listen on (written into nothing — run.bat uses 8000).

.EXAMPLE
    .\scripts\build_package.ps1
    .\scripts\build_package.ps1 -PythonVersion 3.11.10
#>

param(
    [string]$PythonVersion = "3.11.9"
)

$ErrorActionPreference = "Stop"
$root      = Split-Path $PSScriptRoot -Parent
$buildDir  = Join-Path $root "build-tmp"
$distDir   = Join-Path $root "dist"
$pkgName   = "doc-template-studio"
$pkgDir    = Join-Path $buildDir $pkgName

Write-Host ""
Write-Host "=== Doc Template Studio — Windows Package Builder ===" -ForegroundColor Cyan
Write-Host "    Python $PythonVersion  |  Output: dist\doc-template-studio-win.zip"
Write-Host ""

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow
foreach ($cmd in @("node", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "$cmd not found. Install Node.js (https://nodejs.org) and re-run."
    }
}
Write-Host "      node $(node --version)  npm $(npm --version)" -ForegroundColor Green

# ── 2. Build frontend ─────────────────────────────────────────────────────────
Write-Host "[2/6] Building React frontend..." -ForegroundColor Yellow
Push-Location (Join-Path $root "frontend")
try {
    npm install --legacy-peer-deps --prefer-offline 2>&1 | Out-Null
    npm run build 2>&1 | Out-Null
} finally {
    Pop-Location
}
Write-Host "      Frontend built to backend\static\" -ForegroundColor Green

# ── 3. Prepare package directory ──────────────────────────────────────────────
Write-Host "[3/6] Assembling package directory..." -ForegroundColor Yellow
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory -Path $pkgDir | Out-Null

# Copy backend source — exclude dev-only and runtime dirs
$backendSrc  = Join-Path $root "backend"
$backendDest = Join-Path $pkgDir "backend"
New-Item -ItemType Directory -Path $backendDest | Out-Null

$excludeNames = @("venv", "__pycache__", ".pytest_cache", "data", "uploads", "exports")
Get-ChildItem $backendSrc | Where-Object { $_.Name -notin $excludeNames } |
    ForEach-Object { Copy-Item $_.FullName $backendDest -Recurse }

# Create empty runtime dirs so they exist on first launch
@("data", "uploads", "exports") | ForEach-Object {
    New-Item -ItemType Directory -Path (Join-Path $backendDest $_) | Out-Null
}

Write-Host "      Backend source copied" -ForegroundColor Green

# ── 4. Bundle portable Python ─────────────────────────────────────────────────
Write-Host "[4/6] Bundling Python $PythonVersion (embeddable)..." -ForegroundColor Yellow

$pyDir    = Join-Path $pkgDir "python-win"
$pyZip    = Join-Path $buildDir "python-embed.zip"
$pyUrl    = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$getPipPy = Join-Path $buildDir "get-pip.py"
$getPipUrl = "https://bootstrap.pypa.io/get-pip.py"

New-Item -ItemType Directory -Path $pyDir | Out-Null

Write-Host "      Downloading Python embeddable..." -ForegroundColor DarkGray
Invoke-WebRequest -Uri $pyUrl -OutFile $pyZip -UseBasicParsing

Write-Host "      Extracting..." -ForegroundColor DarkGray
Expand-Archive -Path $pyZip -DestinationPath $pyDir -Force

# Enable site-packages: the ._pth file ships with '#import site' commented out
$pthFile = Get-ChildItem $pyDir -Filter "python*._pth" | Select-Object -First 1
if ($pthFile) {
    $pth = Get-Content $pthFile.FullName -Raw
    $pth = $pth -replace '#import site', 'import site'
    Set-Content -Path $pthFile.FullName -Value $pth -Encoding ASCII -NoNewline
    Write-Host "      Enabled site-packages ($($pthFile.Name))" -ForegroundColor DarkGray
} else {
    Write-Warning "Could not find ._pth file — site-packages may not load."
}

# Install pip into the embedded environment
Write-Host "      Installing pip..." -ForegroundColor DarkGray
Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPy -UseBasicParsing
& "$pyDir\python.exe" $getPipPy --quiet 2>&1 | Out-Null

# Install all backend requirements
Write-Host "      Installing Python packages (this may take a minute)..." -ForegroundColor DarkGray
$reqFile = Join-Path $backendDest "requirements.txt"
& "$pyDir\python.exe" -m pip install -r $reqFile --quiet 2>&1 | Out-Null
Write-Host "      Python packages installed" -ForegroundColor Green

# ── 5. Add launcher ───────────────────────────────────────────────────────────
Write-Host "[5/6] Adding run.bat launcher..." -ForegroundColor Yellow
Copy-Item (Join-Path $root "run.bat") (Join-Path $pkgDir "run.bat")
Write-Host "      Done" -ForegroundColor Green

# ── 6. Create zip ─────────────────────────────────────────────────────────────
Write-Host "[6/6] Creating distribution zip..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
$zipPath = Join-Path $distDir "doc-template-studio-win.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path $pkgDir -DestinationPath $zipPath
Write-Host "      Created: dist\doc-template-studio-win.zip" -ForegroundColor Green

# Cleanup build temp
Remove-Item $buildDir -Recurse -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "=== Done! dist\doc-template-studio-win.zip  ($sizeMB MB) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Distribute that zip. Recipients:"
Write-Host "  1. Extract the zip anywhere."
Write-Host "  2. Double-click run.bat."
Write-Host "  3. Browser opens at http://localhost:8000."
Write-Host ""
