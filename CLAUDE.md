# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OneTools is a macOS desktop utility app built with Electron, React, and TypeScript. It is designed as a **toolset** — each feature is a self-contained "tool" registered in a registry, so new utilities can be added without modifying the app shell. Current tools: an audio format converter and an audio splitter (both powered by FFmpeg), and a Markdown-to-PDF renderer (powered by Electron's bundled Chromium — no external binary).

## Design Principle: one tool = one responsibility (do not merge tools)

Each tool must be **independent and single-purpose**. Do not fold one capability into another's UI or options just because they share infrastructure (FFmpeg, file picking, progress UI). Specifically:

- Audio **conversion** (change format) and audio **splitting** (cut into parts) are **separate tools** — separate sidebar entries, separate pages, separate IPC channels, separate services. A user who wants to split does not also want to re-encode, and vice versa. Merging them couples their parameters (e.g. a split-size option sitting inside a converter's parameter panel becomes meaningless for lossless formats) and makes each tool harder to maintain and reason about.
- Shared *infrastructure* (`ffmpegRunner.ts`, `DropZone`, `ProgressBar`, `FileList`, the file-dialog IPC) is fine and encouraged — extract it into reusable modules. What must stay separate is the *tool surface*: its component, its service, its IPC handler, its preload API methods, its store.
- When adding a capability, ask first: "Is this an option of an existing tool, or a new tool?" If a user would plausibly want it without the other tool's behavior, it is a new tool. Default to a new tool.
- Each tool gets its own folder under `src/renderer/components/tools/<ToolName>/`, its own hook under `src/renderer/hooks/`, its own Zustand store under `src/renderer/store/`, its own service under `src/main/services/`, and its own IPC handler under `src/main/ipc/` registered in `src/main/ipc/index.ts`.

## Common Commands

```bash
npm run dev          # Start Electron + Vite dev server (HMR). DevTools opens automatically.
npm run build        # Build main/preload/renderer via electron-vite → out/
npm run build:mac    # Build + package as .dmg/.zip via electron-builder → dist/
```

**Runtime gotcha — Electron binary must be installed manually.** `npm install`/`pnpm install` frequently skips `electron`'s postinstall script, leaving `node_modules/electron/path.txt` absent. This causes `Error: Electron uninstall` at dev startup. Fix by running `node node_modules/electron/install.js` (set `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` if GitHub downloads are blocked). The `out/` directory alone existing is NOT a sign Electron installed correctly.

**FFmpeg binary must be present for the audio converter to work.** Place the static binary at `resources/ffmpeg/<arch>/ffmpeg` (e.g. `resources/ffmpeg/arm64/ffmpeg`). `src/main/utils/paths.ts` resolves this; `src/main/services/ffmpegManager.ts` tries the bundled binary first, then falls back to `ffmpeg` on `$PATH`. If absent, conversions fail with `ENOENT`. The binaries are committed to the repo and must be self-contained (static) — a Homebrew ffmpeg links `/opt/homebrew` dylibs, cannot run on machines without Homebrew, and cannot be notarized. There is no download script: place a static build from [evermeet.cx](https://evermeet.cx/ffmpeg/) at `resources/ffmpeg/<arch>/ffmpeg` (both `arm64` and `x64`; `x64` is currently empty) and check it with `otool -L` (only `/usr/lib` + `/System` deps allowed). Signing/notarization is mandatory in CI — see `.github/workflows/build-macos.yml`.

**Tests:** Vitest (`npm test` / `npm run test:watch`). Pure, Electron-free logic is extracted into standalone modules under `src/main/utils/` and `src/main/services/` so it can be unit-tested without spawning ffmpeg or importing Electron: `outputPath.ts` (`resolveUniqueOutputPath`), `codecArgs.ts` (`buildFfmpegArgs`/`appendCodecArgs`), `splitArgs.ts` (`buildSegmentArgs`/`sizeToSegmentDuration`/`expectedSegmentCount`/`partFileName`). Tests live alongside source as `*.test.ts` and are excluded from both tsconfigs (vitest type-checks them at run time). Run `npm run build:mac` to produce `dist/*.dmg` + `*.zip` (ffmpeg is bundled as `extraResources`; signing is mandatory — `mac.forceCodeSigning: true` makes electron-builder fail rather than emit an unsigned app).

## Architecture

### Three-process Electron model (electron-vite)

`electron.vite.config.ts` builds three independent entry points. Code is strictly partitioned — renderer has no Node access; all native work goes through IPC.

- **Main process** (`src/main/`, output `out/main/index.js`): app lifecycle, window creation, FFmpeg spawning, file dialogs. Entry: `src/main/index.ts` creates the `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `titleBarStyle: 'hiddenInset'`, and registers all IPC handlers + app menu.
- **Preload** (`src/preload/index.ts` → `out/preload/index.js`): the *only* bridge. Exposes a typed `window.electronAPI` via `contextBridge.exposeInMainWorld`. Every renderer→main call and main→renderer event listener is declared here as the single source of truth for the IPC contract.
- **Renderer** (`src/renderer/`, root for Vite): React 19 app, styled with CSS Modules + CSS custom properties (dark theme tokens in `src/renderer/styles/global.css`). State via Zustand.

### IPC contract (the critical seam)

Channel names live in `src/shared/constants.ts` (`IPC` for renderer→main `invoke`, `IPC_EVENTS` for main→renderer `webContents.send`). **To add any IPC interaction you must touch three files in lockstep:** the constant in `shared/constants.ts`, a handler in `src/main/ipc/*.ts` (registered via `src/main/ipc/index.ts`), and the exposed method in `src/preload/index.ts`. The preload's `ElectronAPI` interface is the canonical type both sides import from `src/shared/types.ts`.

### Shared FFmpeg infrastructure

`src/main/services/ffmpegRunner.ts` holds the reusable ffmpeg primitives that both audio tools depend on, but that are *not* tool-specific:

- `runFfmpeg()` — spawns ffmpeg once, parses `-progress pipe:1` stdout (`out_time_ms=` / `speed=` / `progress=end`), throttles progress to ~5fps, and resolves on exit. Takes a `computePercent` callback so the caller scales raw output-time into whole-job 0–100% (e.g. per-segment progress for the splitter), and a `progressEvent` arg so each tool gets its own IPC progress channel.
- `getAudioDuration()` — duration via `ffprobe` when available, else falls back to parsing `ffmpeg -i ... -f null -` stderr (needed when only `ffmpeg` is bundled, not `ffprobe`).
- `getBytesPerSec()` — source file's average byte density, used to convert a target split size into a segment duration.

`ffmpegManager.ts` owns binary discovery/resolution and exposes `spawn()`. Both tools call `ffmpegManager.resolveBinary()` before their first spawn.

### Audio conversion tool (format change)

1. Renderer (`src/renderer/hooks/useAudioConverter.ts`) collects files + options, calls `window.electronAPI.startConversion(job)`.
2. Main (`src/main/ipc/audioConverter.ts`) delegates to `src/main/services/audioConverter.ts`.
3. `AudioConverter` builds one ffmpeg command per file (codec per format from `audioFormats.ts`), runs it via `runFfmpeg`, and pushes `CONVERSION_*` events. **Output conflicts** are avoided by `resolveUniqueOutputPath()` — if `name.ext` exists it writes `name (1).ext`, `(2)`, etc.
4. Conversions run with a **bounded concurrency pool** (`runWithConcurrency`, `MAX_CONCURRENCY = min(3, cpus-1)`) in the renderer hook, not sequentially. The hook also handles de-dup of dropped files, per-job retry, cancel, and reveal-in-Finder.
5. Job state lives in `src/renderer/store/conversionStore.ts`; the hook wires IPC listeners to store updates on mount; `ConversionQueue` renders progress with retry (↻) / show-in-Finder (🔍) / remove (🗑) actions.

### Audio splitter tool (cut into parts)

A **separate** tool from conversion (see Design Principle above). Cuts one file into multiple parts without re-encoding (`-c copy`), by target size (MB) or duration (seconds).

1. Renderer (`src/renderer/hooks/useAudioSplitter.ts`) → `window.electronAPI.startSplit(job)`.
2. Main (`src/main/ipc/audioSplitter.ts`) → `src/main/services/audioSplitter.ts`.
3. The splitter converts the user's target into a per-segment duration (size mode: `targetBytes × SIZE_SAFETY_MARGIN / getBytesPerSec()` — the 0.9 margin keeps stream-copy segments at or under the requested size since they can only cut on keyframe boundaries; duration mode: direct), computes `expected = ceil(total / segDur)`, cleans stale `_partNNN` files, then runs one ffmpeg per segment via `runFfmpeg` with `progressEvent = IPC_EVENTS.SPLIT_PROGRESS`. Per-segment progress is scaled into whole-job progress in the `computePercent` callback. Runs sequentially (one segment at a time).
4. Uses its own `SPLIT_*` IPC channels and `src/renderer/store/splitStore.ts`; UI is `src/renderer/components/tools/AudioSplitter/` (`AudioSplitter.tsx`, `SplitQueue.tsx`). Output files are named `<baseName>_part000.<ext>`, `_part001`, …

### Shared filesystem + menu IPC

`src/main/ipc/filesystem.ts` exposes `showItemInFolder` (highlight a file in Finder), `revealInFinder` (open a folder), and `fileExists` (output-conflict checks). The application menu (`src/main/menu.ts`) broadcasts `menu:openFiles` (⌘O), `menu:revealOutput` (⌘⇧R), and `menu:preferences` (⌘,) events; the renderer subscribes via the preload's `onMenu`/`offMenu` API (declared on `ElectronAPI`). These menu events are scoped per-tool — each tool's component subscribes to the ones it cares about.

### Format/parameter mapping

`src/shared/audioFormats.ts` is the single definition of supported formats (codec, extension, default bitrate/sample-rate/channels, and flags like `supportsBitrate`/`supportsVbr`). `AudioConverter.appendCodecArgs()` maps each format id to the correct `-c:a` codec and args; `ParameterPanel` in the converter reads the same flags to show/hide the bitrate control (e.g. lossless formats hide bitrate) and to show the VBR toggle for Opus. When adding a format, update this file and the switch in `appendCodecArgs`. The splitter does **not** use this mapping — it stream-copies (`-c copy`) and preserves the source codec.

### Markdown → PDF tool (document render)

A **separate** tool from the audio tools (see Design Principle above). Renders a Markdown document to a styled PDF. Unlike the audio tools it needs **no external binary** — it uses Electron's bundled Chromium via `webContents.printToPDF`.

1. Renderer (`src/renderer/hooks/useMarkdownPdf.ts`) → `window.electronAPI.startMarkdownPdf(job)`.
2. Main (`src/main/ipc/markdownPdf.ts`) → `src/main/services/markdownPdf.ts`.
3. `MarkdownPdfConverter.convert()` reads the `.md` file, renders it to a themed HTML document via the **pure, testable** `src/main/utils/markdownRender.ts` (`renderMarkdownDocument` → `marked` with GFM + line breaks, wrapped in `buildHtmlDocument` with light/sepia/dark CSS), loads that HTML into a hidden `BrowserWindow` from a base64 data URL, awaits `did-finish-load`, then calls `webContents.printToPDF` with the user's page-size/orientation/margins and `printBackground: true` (so theme backgrounds survive). The PDF buffer is written via `resolveUniqueOutputPath()` (same `<baseName>.pdf` / ` (1).pdf` conflict rule as the converter).
4. Progress is coarse (5/20/35/60/85/100 — read → render → load → print → write), sent on its own `MD_PDF_*` IPC channels. Cancel destroys the hidden render window (which rejects `printToPDF`); a `cancelledJobs` set suppresses the resulting error so the job stays `cancelled` rather than flipping to `error`.
5. Uses its own `MD_PDF_*` IPC channels, `src/renderer/store/markdownPdfStore.ts`, hook `useMarkdownPdf.ts`, and UI under `src/renderer/components/tools/MarkdownPdf/`. `marked` is a runtime dependency (externalized by `externalizeDepsPlugin`, packed into the app by electron-builder).

The shared file-open dialog (`IPC.SELECT_INPUT_FILES`) takes an optional `kind: 'audio' | 'markdown'` argument so the markdown tool gets Markdown filters while audio callers (which pass nothing) are unaffected. Drag-and-drop filtering is generalized similarly: `useFileDrop(onFilesDrop, extensions?)` defaults to the audio extensions. `DropZone` takes optional `icon`/`label`/`formats` props (defaults to the audio wording).

### Tool registry (extensibility pattern)

`src/main/services/toolRegistry.ts` holds `ToolDefinition`s. The sidebar (`src/renderer/components/layout/Sidebar.tsx`) currently hardcodes its tool list rather than reading the registry, and `App.tsx` switches on `activeTool` from `src/renderer/store/appStore.ts`. Adding a new tool means: a component under `src/renderer/components/tools/<ToolName>/`, an entry in the sidebar, and a branch in `App.tsx` (IPC handlers in `src/main/ipc/` if it needs native access).

### Window chrome

`titleBarStyle: 'hiddenInset'` hides the native title bar, so `src/renderer/components/layout/AppShell.tsx` renders a `dragBar` (`-webkit-app-region: drag`, 38px tall) above the sidebar/content so the window is draggable. Interactive elements within drag regions must opt out with `-webkit-app-region: no-drag`.

## Packaging

`electron-builder.yml` bundles `resources/ffmpeg` as `extraResources` (so ffmpeg lands at `Resources/ffmpeg/` in the `.app`), targets `dmg` + `zip`, and enables macOS Hardened Runtime with `build/entitlements.mac.plist`. Code signing/notarization config is scaffolded but not yet wired to real credentials.
