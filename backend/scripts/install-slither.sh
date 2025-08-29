#!/bin/bash

# Slither Installation Script for Audit Wolf Backend
# This script installs Slither static analyzer for Solidity

set -e

echo "🔍 Installing Slither Static Analyzer..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3.8 or higher and try again."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.8"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Python $REQUIRED_VERSION or higher is required. Found: $PYTHON_VERSION"
    exit 1
fi

echo "✅ Python $PYTHON_VERSION found"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed."
    echo "Please install pip3 and try again."
    exit 1
fi

echo "✅ pip3 found"

# Install Slither
echo "📦 Installing Slither via pip..."
pip3 install slither-analyzer

# Verify installation
if command -v slither &> /dev/null; then
    SLITHER_VERSION=$(slither --version 2>&1 | head -n1)
    echo "✅ Slither installed successfully: $SLITHER_VERSION"
else
    echo "❌ Slither installation failed or not in PATH"
    echo "Please ensure ~/.local/bin is in your PATH"
    exit 1
fi

# Install additional dependencies for better analysis
echo "📦 Installing additional Solidity tools..."

# Try to install solc-select for Solidity compiler management
pip3 install solc-select || echo "⚠️  solc-select installation failed (optional)"

echo ""
echo "🎉 Slither installation completed!"
echo ""
echo "Next steps:"
echo "1. Ensure ~/.local/bin is in your PATH"
echo "2. Test the installation: slither --version"
echo "3. Install Solidity compiler: solc-select install 0.8.19 && solc-select use 0.8.19"
echo ""
echo "For more information, visit: https://github.com/crytic/slither"