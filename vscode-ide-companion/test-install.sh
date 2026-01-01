#!/bin/bash

# Test Installation Script for Recoder Code VSCode Extension

echo "=== Recoder Code VSCode Extension - Installation Test ==="
echo ""

# Check if VSIX exists
if [ ! -f "recoder-code-vscode-companion-1.0.0.vsix" ]; then
    echo "❌ VSIX file not found!"
    exit 1
fi

echo "✅ VSIX file found ($(du -h recoder-code-vscode-companion-1.0.0.vsix | cut -f1))"
echo ""

# Check if code CLI is available
if ! command -v code &> /dev/null; then
    echo "❌ VSCode CLI 'code' not found in PATH"
    echo "   Install it from VSCode: Cmd+Shift+P → 'Shell Command: Install code command in PATH'"
    exit 1
fi

echo "✅ VSCode CLI found"
echo ""

# List current version if installed
CURRENT=$(code --list-extensions --show-versions | grep recoder-code-vscode-companion || echo "Not installed")
echo "Current installation: $CURRENT"
echo ""

# Ask user to proceed
read -p "Install/Update extension? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled"
    exit 0
fi

echo ""
echo "Installing extension..."
code --install-extension recoder-code-vscode-companion-1.0.0.vsix --force

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Extension installed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Reload VSCode window (Cmd+Shift+P → 'Developer: Reload Window')"
    echo "2. Look for Recoder Code icon in Activity Bar (left sidebar)"
    echo "3. Run: Cmd+Shift+P → 'Recoder Code: Login'"
    echo ""
else
    echo ""
    echo "❌ Installation failed"
    exit 1
fi
