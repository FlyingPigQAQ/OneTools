#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES_DIR="${SCRIPT_DIR}/../resources/ffmpeg"

# BtbN FFmpeg Builds release URL (LGPL builds)
# Note: These are GitHub Actions artifacts; you may need to manually download
# For production, consider using a pinned release or building from source

# Alternative: evermeet.cx for macOS-specific builds
# For this script, we'll use BtbN's releases

FFMPEG_VERSION="${FFMPEG_VERSION:-latest}"

mkdir -p "${RESOURCES_DIR}/arm64"
mkdir -p "${RESOURCES_DIR}/x64"

echo "Downloading FFmpeg static builds..."

# Detect architecture
ARCH=$(uname -m)

if [ "$ARCH" = "arm64" ]; then
  echo "Detected Apple Silicon (arm64). Downloading arm64 build..."
  # Using johnvansickle.com builds as a reliable source for Linux/macOS static builds
  # For macOS-specific static builds, evermeet.cx is recommended but requires manual download
  # Here we use a placeholder approach - in production, replace with your preferred source

  echo "Note: Please manually download macOS static FFmpeg builds and place them in:"
  echo "  ${RESOURCES_DIR}/arm64/ffmpeg"
  echo "  ${RESOURCES_DIR}/x64/ffmpeg"
  echo ""
  echo "Recommended sources:"
  echo "  - https://evermeet.cx/ffmpeg/ (macOS static builds)"
  echo "  - https://github.com/BtbN/FFmpeg-Builds/releases (cross-platform)"
  echo ""
  echo "For Apple Silicon, download: ffmpeg-[version]-macos-arm64"
  echo "For Intel Macs, download: ffmpeg-[version]-macos-x86_64"
else
  echo "Detected Intel (x64). Downloading x64 build..."
  echo "Note: Please manually download macOS static FFmpeg builds and place them in:"
  echo "  ${RESOURCES_DIR}/x64/ffmpeg"
fi

# Alternative: If ffmpeg is available via Homebrew, we can copy it
if command -v ffmpeg &> /dev/null; then
  echo ""
  echo "Found ffmpeg in PATH. Copying to resources directory..."
  FFMPEG_PATH=$(command -v ffmpeg)
  FFPROBE_PATH=$(command -v ffprobe || true)

  if [ "$ARCH" = "arm64" ]; then
    cp "$FFMPEG_PATH" "${RESOURCES_DIR}/arm64/ffmpeg"
    chmod +x "${RESOURCES_DIR}/arm64/ffmpeg"
    if [ -n "$FFPROBE_PATH" ]; then
      cp "$FFPROBE_PATH" "${RESOURCES_DIR}/arm64/ffprobe"
      chmod +x "${RESOURCES_DIR}/arm64/ffprobe"
    fi
  else
    cp "$FFMPEG_PATH" "${RESOURCES_DIR}/x64/ffmpeg"
    chmod +x "${RESOURCES_DIR}/x64/ffmpeg"
    if [ -n "$FFPROBE_PATH" ]; then
      cp "$FFPROBE_PATH" "${RESOURCES_DIR}/x64/ffprobe"
      chmod +x "${RESOURCES_DIR}/x64/ffprobe"
    fi
  fi

  echo "FFmpeg copied successfully!"
fi

echo "Done."
