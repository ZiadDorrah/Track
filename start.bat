@echo off
cd /d "%~dp0"
title Task Tracker Setup and Launch
echo ===================================================
echo   Task Tracker Application Setup and Startup
echo ===================================================
echo.

REM Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ first.
    echo.
    pause
    exit /b
)

REM Check if node_modules exists, if not run npm install
if not exist node_modules (
    echo Installing required packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install packages.
        pause
        exit /b
    )
    echo Packages installed successfully!
    echo.
)

REM Check if dist directory exists, if not compile React assets
if not exist dist (
    echo Compiling React application assets...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Failed to compile React application.
        pause
        exit /b
    )
    echo Application compiled successfully!
    echo.
)

echo Starting the Task Tracker server in the background...
echo The application should automatically open in your browser shortly.
echo.

set "CURRENT_DIR=%~dp0"
if "%CURRENT_DIR:~-1%"=="\" set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

REM Launch server.js silently in the background using hidden Powershell process
powershell -WindowStyle Hidden -Command "Start-Process node -ArgumentList 'server.js' -WorkingDirectory '%CURRENT_DIR%' -WindowStyle Hidden"

echo Task Tracker launched successfully! Exiting...
ping 127.0.0.1 -n 4 >nul
exit
