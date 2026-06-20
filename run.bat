@echo off
setlocal
cd /d "%~dp0"

set PYTHON=python-win\python.exe
set PORT=8000

if not exist "%PYTHON%" (
    echo ERROR: Bundled Python not found at python-win\python.exe
    echo Please run scripts\build_package.ps1 first to create the distribution package,
    echo or extract the full doc-template-studio-win.zip which includes python-win\.
    pause
    exit /b 1
)

echo ================================================
echo  Doc Template Studio
echo  http://localhost:%PORT%
echo  Press Ctrl+C to stop the server
echo ================================================
echo.

:: Create runtime dirs in case they were deleted
if not exist "backend\data"    mkdir "backend\data"
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\exports" mkdir "backend\exports"

:: Open browser after 3-second delay (non-blocking)
start "" cmd /c "timeout /t 3 /nobreak > nul & start http://localhost:%PORT%"

:: Start uvicorn using bundled Python; --app-dir adds backend\ to sys.path
%PYTHON% -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port %PORT%

endlocal
