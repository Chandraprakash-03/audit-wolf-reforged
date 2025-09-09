@echo off
REM Slither Installation Script for Audit Wolf Backend (Windows)
REM This script installs Slither static analyzer for Solidity

echo 🔍 Installing Slither Static Analyzer...

REM Check if Python 3 is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python 3 is required but not installed.
    echo Please install Python 3.8 or higher from https://python.org and try again.
    pause
    exit /b 1
)

echo ✅ Python found

REM Check if pip is installed
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ pip is required but not installed.
    echo Please ensure pip is installed with Python.
    pause
    exit /b 1
)

echo ✅ pip found

REM Install Slither
echo 📦 Installing Slither via pip...
pip install slither-analyzer

REM Verify installation
slither --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Slither installation failed or not in PATH
    echo Please ensure Python Scripts directory is in your PATH
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('slither --version 2^>^&1') do set SLITHER_VERSION=%%i
echo ✅ Slither installed successfully: %SLITHER_VERSION%

REM Install additional dependencies
echo 📦 Installing additional Solidity tools...
pip install solc-select 2>nul || echo ⚠️  solc-select installation failed (optional)

echo.
echo 🎉 Slither installation completed!
echo.
echo Next steps:
echo 1. Test the installation: slither --version
echo 2. Install Solidity compiler: solc-select install 0.8.19 ^&^& solc-select use 0.8.19
echo.
echo For more information, visit: https://github.com/crytic/slither
pause