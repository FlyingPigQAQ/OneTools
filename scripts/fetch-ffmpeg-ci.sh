#!/bin/bash
#
# Fetch self-contained (static) macOS FFmpeg binaries for CI packaging.
#
# WHY THIS EXISTS
#   resources/ffmpeg/arm64/ffmpeg currently in the repo is a *Homebrew* build.
#   It is only 431 KB and links 17 dynamic libraries from /opt/homebrew
#   (libavcodec, libx264, libvpx, openssl, dav1d, ...). On a machine without
#   Homebrew it cannot start at all, and inside a bundle it cannot be notarized
#   because those dependencies neither exist on the runner nor carry the
#   hardened runtime. Signed/notarized releases therefore require a static
#   single-file build (no external dylibs).
#
# USAGE
#   scripts/fetch-ffmpeg-ci.sh arm64   # Apple Silicon
#   scripts/fetch-ffmpeg-ci.sh x64     # Intel
#
# It copies the binary to resources/ffmpeg/<arch>/ffmpeg and, when the build
# ships one, ffprobe next to it (the app falls back gracefully if absent).

set -euo pipefail

ARCH="${1:-$(uname -m)}"
case "$ARCH" in
  arm64|x64) ;;
  *) echo "unsupported arch: $ARCH (expected arm64 or x64)" >&2; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_DIR="${SCRIPT_DIR}/../resources/ffmpeg/${ARCH}"
mkdir -p "$DEST_DIR"

# evermeet.cx publishes notarized static macOS builds; arch is selected by Host.
HOST="arm64"
[ "$ARCH" = "x64" ] && HOST="x86_64"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading static ffmpeg for ${ARCH} (${HOST})..."
curl -fsSL -o "$TMP/ffmpeg.zip" "https://evermeet.cx/ffmpeg/getrelease/zip"
unzip -oq "$TMP/ffmpeg.zip" -d "$TMP"

# evermeet builds are arm64-only; guard against silently shipping a wrong arch.
if ! lipo -archs "$TMP/ffmpeg" | grep -q "$ARCH"; then
  echo "::warning::downloaded ffmpeg arch is '$(lipo -archs "$TMP/ffmpeg")', expected ${ARCH}." >&2
fi

install -m 0755 "$TMP/ffmpeg" "$DEST_DIR/ffmpeg"

# ffprobe is optional: getAudioDuration() falls back to parsing `ffmpeg -i` stderr.
if curl -fsSL -o "$TMP/ffprobe.zip" "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip"; then
  unzip -oq "$TMP/ffprobe.zip" -d "$TMP/probe" && install -m 0755 "$TMP/probe/ffprobe" "$DEST_DIR/ffprobe"
else
  echo "ffprobe unavailable; continuing without it."
fi

echo "== otool -L (should show only /usr/lib/... or /System/...):"
otool -L "$DEST_DIR/ffmpeg" || true
echo "Installed: $(ls -la "$DEST_DIR")"
