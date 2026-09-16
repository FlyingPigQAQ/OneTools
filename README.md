# OneTools

A macOS desktop **toolset** built with Electron, React, and TypeScript. Each feature is a self-contained "tool" registered in a registry, so new utilities can be added without touching the app shell. Powered by a bundled FFmpeg.

Current tools:

- **Audio Converter** — change an audio file's format (MP3, AAC, FLAC, WAV, OGG, Opus, ALAC/M4A) with control over bitrate, sample rate, channels, and Opus VBR. Batch convert with bounded concurrency.
- **Audio Splitter** — cut one audio file into multiple parts by target size (MB) or duration (seconds), without re-encoding (stream copy, preserves the source codec).

Conversion and splitting are deliberately **separate tools** — a user who wants to split doesn't also want to re-encode, and vice versa. They share FFmpeg infrastructure but have their own components, services, IPC channels, and stores.

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 18+
- npm (or pnpm)
- [FFmpeg](https://ffmpeg.org/) static binary

## Getting started

```bash
npm install
npm run dev
```

**Electron binary gotcha:** `npm install` frequently skips Electron's postinstall script, leaving `node_modules/electron/path.txt` absent and causing `Error: Electron uninstall` at startup. Fix it with:

```bash
node node_modules/electron/install.js
# if GitHub downloads are blocked:
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

The presence of an `out/` directory is **not** proof that Electron installed correctly — check for `node_modules/electron/path.txt`.

### FFmpeg binary

The audio tools need a static FFmpeg binary at `resources/ffmpeg/<arch>/ffmpeg` (e.g. `resources/ffmpeg/arm64/ffmpeg`). Without it, conversions fail with `ENOENT`. `src/main/utils/paths.ts` resolves this; `ffmpegManager.ts` tries the bundled binary first, then falls back to `ffmpeg` on `$PATH`.

```bash
# Easiest: copy your Homebrew ffmpeg into place (local development only)
./scripts/download-ffmpeg.sh

# For release builds: fetch a self-contained/static binary (required for notarization)
./scripts/fetch-ffmpeg-ci.sh arm64
```

Or download a macOS static build manually from [evermeet.cx](https://evermeet.cx/ffmpeg/) (recommended) or [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) and place it at `resources/ffmpeg/arm64/ffmpeg`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Electron + Vite dev server with HMR (DevTools opens automatically). |
| `npm run build` | Build main/preload/renderer via electron-vite → `out/`. |
| `npm run build:mac` | Build + package as `.dmg`/`.zip` via electron-builder → `dist/`. |
| `npm test` | Run the Vitest unit-test suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |

## Testing

Unit tests ([Vitest](https://vitest.dev/)) cover the pure, Electron-free logic. To keep ffmpeg-spawning and Electron-coupled code testable, the pure pieces are extracted into standalone modules:

- `src/main/utils/outputPath.ts` — `resolveUniqueOutputPath` (output-collision `(1)`/`(2)`… resolution)
- `src/main/services/codecArgs.ts` — `buildFfmpegArgs` / `appendCodecArgs` (per-format codec mapping)
- `src/main/services/splitArgs.ts` — `buildSegmentArgs`, `sizeToSegmentDuration`, `expectedSegmentCount`, `partFileName`, `SIZE_SAFETY_MARGIN`

Tests live alongside source as `*.test.ts` and are excluded from the production tsconfigs (Vitest type-checks them at run time). Run them with `npm test`.

There are no integration/e2e tests and no renderer tests — coverage is unit-only for pure logic.

## Architecture

OneTools uses the standard three-process Electron model (via `electron.vite.config.ts`):

- **Main** (`src/main/`) — app lifecycle, window creation, FFmpeg spawning, file dialogs, application menu. Code is strictly partitioned: the renderer has no Node access; all native work goes through IPC.
- **Preload** (`src/preload/index.ts`) — the *only* bridge. Exposes a typed `window.electronAPI` via `contextBridge.exposeInMainWorld`. This is the single source of truth for the IPC contract.
- **Renderer** (`src/renderer/`) — React 19 app, styled with CSS Modules + CSS custom properties (dark theme), state via Zustand.

### IPC contract — the critical seam

Channel names live in `src/shared/constants.ts` (`IPC` for renderer→main `invoke`, `IPC_EVENTS` for main→renderer `send`). **To add any IPC interaction you must touch three files in lockstep:** the constant in `shared/constants.ts`, a handler in `src/main/ipc/*.ts` (registered via `src/main/ipc/index.ts`), and the exposed method in `src/preload/index.ts`. The `ElectronAPI` interface in `src/shared/types.ts` is the canonical type both sides import.

### Shared FFmpeg infrastructure

`src/main/services/ffmpegRunner.ts` holds the reusable ffmpeg primitives both tools depend on, but that are *not* tool-specific:

- `runFfmpeg()` — spawns ffmpeg once, parses `-progress pipe:1` stdout, throttles progress to ~5fps, resolves on exit. Takes a `computePercent` callback so the caller scales raw output-time into whole-job 0–100%, and a `progressEvent` arg so each tool gets its own progress channel.
- `getAudioDuration()` — duration via `ffprobe` when available, else falls back to parsing `ffmpeg -i ... -f null -` stderr.
- `getBytesPerSec()` — source file's average byte density, used to convert a target split size into a segment duration.

`ffmpegManager.ts` owns binary discovery/resolution and exposes `spawn()`.

### Audio converter

1. Renderer (`src/renderer/hooks/useAudioConverter.ts`) collects files + options, calls `window.electronAPI.startConversion(job)`.
2. Main (`src/main/ipc/audioConverter.ts`) → `src/main/services/audioConverter.ts`.
3. One ffmpeg command per file (codec per format from `audioFormats.ts`), run via `runFfmpeg`, pushing `CONVERSION_*` events. Output conflicts avoided by `resolveUniqueOutputPath()` — if `name.ext` exists it writes `name (1).ext`, `(2)`, etc.
4. Conversions run with a **bounded concurrency pool** (`runWithConcurrency`, `MAX_CONCURRENCY = min(3, cpus-1)`). The hook also handles dropped-file dedup, per-job retry, cancel, and reveal-in-Finder.

### Audio splitter

A **separate** tool. Cuts one file into parts without re-encoding (`-c copy`), by size (MB) or duration (seconds).

1. Renderer (`src/renderer/hooks/useAudioSplitter.ts`) → `window.electronAPI.startSplit(job)`.
2. Main (`src/main/ipc/audioSplitter.ts`) → `src/main/services/audioSplitter.ts`.
3. Converts the target into a per-segment duration (size mode: `targetBytes × 0.9 / getBytesPerSec()` — the 0.9 margin keeps stream-copy segments at or under the requested size since they can only cut on keyframe boundaries; duration mode: direct), computes `expected = ceil(total / segDur)`, cleans stale `_partNNN` files, then runs one ffmpeg per segment. Per-segment progress is scaled into whole-job progress. Runs sequentially.

Output files are named `<baseName>_part000.<ext>`, `_part001`, …

### Format mapping

`src/shared/audioFormats.ts` is the single definition of supported formats (codec, extension, default bitrate/sample-rate/channels, and flags like `supportsBitrate`/`supportsVbr`). `appendCodecArgs()` in `codecArgs.ts` maps each format id to its `-c:a` codec and args; the converter's `ParameterPanel` reads the same flags to show/hide the bitrate control (lossless formats hide it) and the VBR toggle for Opus. **The splitter does not use this mapping** — it stream-copies (`-c copy`) and preserves the source codec.

### Adding a new tool

The sidebar (`src/renderer/components/layout/Sidebar.tsx`) currently hardcodes its tool list rather than reading `src/main/services/toolRegistry.ts`, and `App.tsx` switches on `activeTool` from `src/renderer/store/appStore.ts`. Adding a new tool means: a component under `src/renderer/components/tools/<ToolName>/`, an entry in the sidebar, a branch in `App.tsx`, and IPC handlers in `src/main/ipc/` (registered in `src/main/ipc/index.ts`) if it needs native access. Give it its own hook, Zustand store, and service — do **not** fold it into an existing tool (see the design principle below).

## Design principle: one tool = one responsibility

Each tool must be **independent and single-purpose**. Do not fold one capability into another's UI or options just because they share infrastructure (FFmpeg, file picking, progress UI). Audio **conversion** (change format) and audio **splitting** (cut into parts) are separate tools — separate sidebar entries, pages, IPC channels, services, stores.

Shared *infrastructure* (`ffmpegRunner.ts`, `DropZone`, `ProgressBar`, `FileList`, the file-dialog IPC) is fine and encouraged — extract it into reusable modules. What must stay separate is the *tool surface*: its component, service, IPC handler, preload API methods, and store.

When adding a capability, ask first: "Is this an option of an existing tool, or a new tool?" If a user would plausibly want it without the other tool's behavior, it is a new tool. Default to a new tool.

## Packaging

`electron-builder.yml` bundles `resources/ffmpeg` as `extraResources` (so FFmpeg lands at `Resources/ffmpeg/` in the `.app`), targets `dmg` + `zip`, and enables macOS Hardened Runtime with `build/entitlements.mac.plist`.

```bash
npm run build:mac           # → dist/onetools-<version>-arm64.dmg + .zip
npm run build:mac:universal # universal binary (arm64 + x64)
```

### Code signing & notarization (CI)

Releases are built on GitHub-hosted macOS runners by `.github/workflows/build-macos.yml`:

- push a `v*` tag → signed + notarized build published as a GitHub Release
- `workflow_dispatch` → manual run, signed by default (`sign` toggle)

Signing is driven entirely by repository secrets (`Settings → Secrets and variables → Actions`).
Missing secrets do **not** fail the build: it prints a warning and produces an unsigned app.

| Secret | Purpose |
| --- | --- |
| `MAC_CSC_LINK` | base64 of the `.p12` (`base64 -i cert.p12`) or an `https://` URL to it. Must be a **Developer ID Application** certificate |
| `MAC_CSC_KEY_PASSWORD` | password of that `.p12` |
| `KEYCHAIN_PASSWORD` | any random string; password for the throwaway keychain the workflow creates |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password for that Apple ID |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |

The certificate is imported into a temporary keychain (`CSC_KEYCHAIN`), the identity is resolved
from the keychain, then `electron-builder` signs with Hardened Runtime and uploads the `.dmg`/`.zip`
to Apple's notary service. The workflow then verifies the signature (`codesign --verify --deep --strict`)
and the staple (`xcrun stapler validate`) before publishing.

`mac.identity` is intentionally **not** hardcoded in `electron-builder.yml` — it resolves from
`CSC_NAME`/`CSC_LINK` and falls back to an unsigned build when no certificate is present.

### FFmpeg must be self-contained

The app resolves FFmpeg at `Resources/ffmpeg/<arch>/ffmpeg`. The binary in `resources/ffmpeg/arm64/`
is currently a **Homebrew** build that links ~17 dylibs from `/opt/homebrew` — it cannot run on a
machine without Homebrew, and it **cannot be notarized** because those dependencies are neither
present on the runner nor hardened.

For signed releases, replace it with a static single-file build (Apple-notarized builds are available
from [evermeet.cx](https://evermeet.cx/ffmpeg/)):

```bash
./scripts/fetch-ffmpeg-ci.sh arm64   # Apple Silicon
./scripts/fetch-ffmpeg-ci.sh x64     # Intel (resources/ffmpeg/x64/ is currently empty)
```

Verify with `otool -L resources/ffmpeg/arm64/ffmpeg` — only `/usr/lib/...` and `/System/...`
entries should remain. The workflow prints a `::warning::` when a bundled binary is still
dynamically linked.

## License

MIT
