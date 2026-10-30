#!/bin/bash

echo "Setting up Android camera connection..."

# Check if adb is installed
if ! command -v adb &> /dev/null; then
    echo "Error: adb not found. Install Android Platform Tools:"
    echo "  brew install android-platform-tools"
    exit 1
fi

# Check if scrcpy is installed
if ! command -v scrcpy &> /dev/null; then
    echo "Error: scrcpy not found. Install it:"
    echo "  brew install scrcpy"
    exit 1
fi

echo "✓ Tools installed"
echo ""
echo "Connect your Android device via USB and enable USB debugging"
echo "Then run: adb devices"
echo ""
echo "To start camera feed: scrcpy --no-audio --max-fps=15"
