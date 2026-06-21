@echo off
cd /d "%~dp0"
title Stop Task Tracker
echo ===================================================
echo   Stopping Task Tracker Background Process
echo ===================================================
echo.

REM Look for any process listening on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Found Task Tracker process with PID %%a on port 3000.
    echo Terminating process...
    taskkill /F /PID %%a
    echo.
    echo Task Tracker stopped successfully.
    ping 127.0.0.1 -n 4 >nul
    exit
)

echo [INFO] Task Tracker is not currently running on port 3000.
echo.
pause
