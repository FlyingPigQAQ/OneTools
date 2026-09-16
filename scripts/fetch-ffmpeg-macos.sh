#!/usr/bin/env bash
#
# Download the static macOS FFmpeg/FFprobe binaries the audio tools bundle.
#
# Why this exists
# ---------------
# The app resolves its ffmpeg at `resources/ffmpeg/<arch>/ffmpeg` (see
# src/main/utils/paths.ts) and the CI build refuses to sign a package whose
# binaries are missing, dynamically linked or of the wrong architecture. The
# binaries are therefore fetched from a pinned release instead of being committed
# (two architectures x two binaries is ~250 MB of repository history).
#
# Source of truth
# ---------------
# https://github.com/eugeneware/ffmpeg-static, release `b6.1.1`.
# These are self-contained (only /usr/lib + /System framework dependencies) and
# already Apple-notarized, so electron-builder can re-sign them with the
# Developer ID certificate.
#
# Every download is verified against a PINNED SHA-256. Nothing is written to
# `resources/ffmpeg` until its hash matches, so a compromised/mutated upstream
# artifact can never end up in a signed build. To bump the version:
#
#   1. change FFMPEG_STATIC_TAG (and the FFMPEG_STATIC_VERSION below)
#   2. ./scripts/fetch-ffmpeg-macos.sh --print-hashes
#   3. paste the new hashes into SHA256 below
#
# This script is NOT run automatically by `npm run build:mac`: a local build
# uses whatever binaries already sit in resources/ffmpeg (or your own).
#
# Usage
#   ./scripts/fetch-ffmpeg-macos.sh                 # both arches, ffmpeg + ffprobe
#   ./scripts/fetch-ffmpeg-macos.sh arm64           # one arch: arm64 | x64
#   ./scripts/fetch-ffmpeg-macos.sh arm64 ffmpeg    # one arch, one binary
#   ./scripts/fetch-ffmpeg-macos.sh --print-hashes  # download and print hashes only
#
# The script is a plain downloader on Linux. On macOS it also runs otool/lipo
# after install, so a dynamically linked or wrong-arch binary never reaches
# packaging.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEST_ROOT="${REPO_ROOT}/resources/ffmpeg"

# Upstream release the hashes below were taken from.
FFMPEG_STATIC_REPO="eugeneware/ffmpeg-static"
FFMPEG_STATIC_TAG="b6.1.1"
# Version reported by the binaries themselves (`ffmpeg -version`).
FFMPEG_STATIC_VERSION="6.1.1"

# Pinned SHA-256 of the upstream artifacts, one line per <arch>/<binary>.
# Regenerate with `./scripts/fetch-ffmpeg-macos.sh --print-hashes`.
SHA256="
arm64/ffmpeg  a90e3db6a3fd35f6074b013f948b1aa45b31c6375489d39e572bea3f18336584
arm64/ffprobe bb2db6f5d8cef919da12fbf592119a987202a8c060a886f3cab091f9cab90b64
x64/ffmpeg    ebdddc936f61e14049a2d4b549a412b8a40deeff6540e58a9f2a2da9e6b18894
x64/ffprobe   fa3add0ce901f7241abe0dfc0155d958fc834aca3f8ce61f87cc712ae669c1e0
"

ARCHES=(arm64 x64)
BINARIES=(ffmpeg ffprobe)
PRINT_HASHES=0

usage() { sed -n '2,45p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --print-hashes) PRINT_HASHES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    arm64|x64) ARCHES=("$1"); shift ;;
    ffmpeg|ffprobe) BINARIES=("$1"); shift ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

pinned_hash() {
  printf '%s\n' "$SHA256" | awk -v key="$1" '$1 == key { print $2; exit }'
}

download() {
  local url="$1" out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 --retry-delay 5 -o "$out" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$out" "$url"
  else
    echo "neither curl nor wget is available" >&2
    return 1
  fi
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "FFmpeg-static ${FFMPEG_STATIC_VERSION} (${FFMPEG_STATIC_REPO} ${FFMPEG_STATIC_TAG})"
echo

# Download everything first, so a failed/partial download never leaves a
# half-populated resources/ffmpeg behind.
for arch in "${ARCHES[@]}"; do
  for bin in "${BINARIES[@]}"; do
    case "${arch}" in
      arm64) asset="${bin}-darwin-arm64" ;;
      x64)   asset="${bin}-darwin-x64" ;;
    esac
    url="https://github.com/${FFMPEG_STATIC_REPO}/releases/download/${FFMPEG_STATIC_TAG}/${asset}"
    dest="${TMP_DIR}/${arch}/${bin}"
    mkdir -p "$(dirname "$dest")"
    echo "==> ${arch}/${bin}  <- ${url}"
    download "$url" "$dest"
    chmod +x "$dest"
  done
done

echo
fail=0
for arch in "${ARCHES[@]}"; do
  for bin in "${BINARIES[@]}"; do
    key="${arch}/${bin}"
    file="${TMP_DIR}/${arch}/${bin}"

    if command -v sha256sum >/dev/null 2>&1; then
      actual="$(sha256sum "$file" | awk '{print $1}')"
    elif command -v shasum >/dev/null 2>&1; then
      actual="$(shasum -a 256 "$file" | awk '{print $1}')"
    else
      echo "no sha256 tool found (need sha256sum or shasum)" >&2
      exit 1
    fi

    if [ "$PRINT_HASHES" = "1" ]; then
      printf '%-14s %s\n' "$key" "$actual"
      continue
    fi

    expected="$(pinned_hash "$key")"
    if [ -z "$expected" ]; then
      echo "ERROR ${key}: no pinned hash in this script (run with --print-hashes, then patch SHA256)" >&2
      fail=1
      continue
    fi
    if [ "$actual" != "$expected" ]; then
      echo "ERROR ${key}: sha256 mismatch" >&2
      echo "  expected: ${expected}" >&2
      echo "  actual:   ${actual}" >&2
      echo "Upstream artifact changed or the download was tampered with. Refusing to install it." >&2
      fail=1
      continue
    fi
    echo "OK   ${key}  sha256 ${actual}"
  done
done

if [ "$PRINT_HASHES" = "1" ]; then
  echo
  echo "Paste the lines above into SHA256 in this script, then re-run without --print-hashes."
  exit 0
fi

[ "$fail" = "0" ] || { echo; echo "Nothing was installed." >&2; exit 1; }

# Hash-verified: now (and only now) populate resources/ffmpeg.
for arch in "${ARCHES[@]}"; do
  for bin in "${BINARIES[@]}"; do
    mkdir -p "${DEST_ROOT}/${arch}"
    install -m 0755 "${TMP_DIR}/${arch}/${bin}" "${DEST_ROOT}/${arch}/${bin}"
  done
done

echo
echo "Installed into ${DEST_ROOT}:"
find "${DEST_ROOT}" -type f -name 'ffmpeg' -o -type f -name 'ffprobe' | sort

if command -v lipo >/dev/null 2>&1 && command -v otool >/dev/null 2>&1; then
  echo
  for bin in "${DEST_ROOT}"/*/ffmpeg "${DEST_ROOT}"/*/ffprobe; do
    [ -f "$bin" ] || continue
    archs=$(lipo -archs "$bin")
    case "$bin" in
      */arm64/*) echo "$archs" | grep -qw arm64  || { echo "ERROR $bin is not arm64" >&2; exit 1; } ;;
      */x64/*)   echo "$archs" | grep -qw x86_64 || { echo "ERROR $bin is not x86_64" >&2; exit 1; } ;;
    esac
    deps=$(otool -L "$bin" | tail -n +2 | awk '{print $1}' | grep -v '^/usr/lib/' | grep -v '^/System/' || true)
    if [ -n "$deps" ]; then
      echo "ERROR $bin links libraries outside /usr/lib and /System ($deps)." >&2
      exit 1
    fi
    echo "OK   ${bin#"${DEST_ROOT}"/}  ${archs}  static"
  done
fi
