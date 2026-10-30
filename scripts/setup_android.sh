#!/bin/bash
# Phantom — Android camera setup helper (dhwanit.md §E).
#
# Two ways to get an Android phone's camera into the engine on macOS:
#
#   A) IP Webcam (wireless, simplest) — recommended
#      1. Install an "IP Webcam" app on the phone (exposes an MJPEG/RTSP stream).
#      2. Start the server in the app; note the URL it shows, e.g.
#         http://192.168.1.42:8080/video
#      3. Point the engine at it:
#         export PHANTOM_CAMERA_SOURCE=android
#         export PHANTOM_CAMERA_URL=http://192.168.1.42:8080/video
#         make run
#
#   B) USB webcam bridge (Iriun / DroidCam)
#      1. Install the bridge app on phone + mac; connect over USB.
#      2. Find the device index:  python scripts/list_cameras.py
#      3. export PHANTOM_CAMERA_SOURCE=android
#         export PHANTOM_CAMERA_INDEX=<index>
#         make run
#
# The adb/scrcpy preflight below is for the USB route / general debugging.

echo "Phantom — Android camera preflight"
echo

if ! command -v adb &> /dev/null; then
    echo "• adb not found (needed for USB debugging). Install:"
    echo "    brew install android-platform-tools"
else
    echo "✓ adb present"
    echo "  Devices:"; adb devices | sed '1d;/^$/d' | sed 's/^/    /'
fi

if ! command -v scrcpy &> /dev/null; then
    echo "• scrcpy not found (optional, for mirroring). Install:"
    echo "    brew install scrcpy"
else
    echo "✓ scrcpy present (v$(scrcpy --version 2>/dev/null | head -1 | awk '{print $2}'))"
fi

echo
echo "Next: pick route A (PHANTOM_CAMERA_URL) or B (PHANTOM_CAMERA_INDEX) above, then: make run"
