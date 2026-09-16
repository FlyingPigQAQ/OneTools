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

The audio tools need a static FFmpeg binary at `resources/ffmpeg/<arch>/ffmpeg` (e.g. `resources/ffmpeg/arm64/ffmpeg`). Without it, conversions fail with `ENOENT`. `src/main/utils/paths.ts` resolves this; `ffmpegManager.ts` tries the bundled binary first, then falls back to `ffmpeg` on `$PATH`. It looks in `<process.arch>` first and then in the other macOS architecture (`getFfmpegArchCandidates`), so a universal build or a Rosetta-launched app still finds its binary.

Fetch both architectures plus `ffprobe` with one command:

```bash
./scripts/fetch-ffmpeg-macos.sh          # arm64 + x64, ffmpeg + ffprobe
./scripts/fetch-ffmpeg-macos.sh arm64    # a single arch
```

The script pulls the pinned [eugeneware/ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) release (FFmpeg 6.1.1) and **verifies every file against a SHA-256 hardcoded in the script** before installing it — a mismatch aborts without touching `resources/ffmpeg/`. The binaries are deliberately **not committed** (two arches x two binaries is ~250 MB of history); `resources/ffmpeg/` is gitignored.

Whatever ends up there is validated by CI and must be:

- **static / self-contained** — a Homebrew ffmpeg links ~17 dylibs from `/opt/homebrew`, so it cannot run on a machine without Homebrew and **cannot be notarized**;
- **matching the target arch** — `resources/ffmpeg/arm64/ffmpeg` (Apple Silicon) and `resources/ffmpeg/x64/ffmpeg` (Intel);
- **signed** — electron-builder signs nested binaries with the same Developer ID during packaging.

Verify locally with `otool -L resources/ffmpeg/arm64/ffmpeg` — only `/usr/lib/...` and `/System/...` entries may remain. Anything else will fail the CI gate.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Electron + Vite dev server with HMR (DevTools opens automatically). |
| `npm run build` | Build main/preload/renderer via electron-vite → `out/`. |
| `npm run build:mac` | Build + package as `.dmg`/`.zip` via electron-builder → `dist/`. |
| `./scripts/fetch-ffmpeg-macos.sh` | Download + hash-verify the static FFmpeg/FFprobe binaries into `resources/ffmpeg/`. |
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

Local builds sign with whatever Developer ID identity is in your keychain; with none present, electron-builder fails (`forceCodeSigning: true`) rather than producing an unsigned app.

### Code signing & notarization (CI) — mandatory

Releases are built on GitHub-hosted macOS runners by `.github/workflows/build-macos.yml`:

- push a `v*` tag → signed + notarized build published as a GitHub Release
- push to a branch, or `workflow_dispatch` → signed + notarized build, uploaded as CI artifacts only

**Signing and notarization are required; there is no unsigned path.** The secrets are checked in a first, cheap gate job (`Check signing secrets`, ubuntu-latest). If any of them is missing the run stops there with an explicit `::error`, before any macOS minutes are spent and before any unsigned artifact can exist. `.github/workflows/build-macos.yml` also runs electron-builder with `--config.forceCodeSigning=true`, so even a misconfigured identity fails the build instead of silently shipping an unsigned `.app`.

| Secret | Purpose |
| --- | --- |
| `MAC_CSC_LINK` | base64 of the `.p12` (`base64 -i cert.p12`) or an `https://` URL to it. Must be a **Developer ID Application** certificate |
| `MAC_CSC_KEY_PASSWORD` | password of that `.p12` |
| `KEYCHAIN_PASSWORD` | any random string; password for the throwaway keychain the workflow creates |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |
| `APPLE_API_KEY` | App Store Connect **Team** API key: PEM contents of `AuthKey_*.p8`, or base64 of that file |
| `APPLE_API_KEY_ID` | 10-character Key ID |
| `APPLE_API_ISSUER` | Issuer UUID of that Team API key |

The certificate is imported into a temporary keychain (`CSC_KEYCHAIN`), the resolved identity is passed as `CSC_NAME`, and `electron-builder` re-imports the same `.p12` into its own keychain (which is what `@electron/notarize` looks the identity up in). It then signs with Hardened Runtime and submits the `.app` to Apple's notary service via `notarytool` and the Team API key. The workflow verifies `codesign --verify --deep --strict` on the `.app` **and** on each bundled ffmpeg/ffprobe binary, then `xcrun stapler validate` before anything is uploaded. Any failure stops the run — a bad or unsigned artifact is never published.

The FFmpeg binaries are fetched by the workflow itself (`./scripts/fetch-ffmpeg-macos.sh`, SHA-256-pinned) rather than committed to the repo, then verified with `otool`/`lipo`: a missing, dynamically linked or wrong-arch binary fails the build before packaging.

`mac.identity` is intentionally **not** hardcoded in `electron-builder.yml`; it resolves from `CSC_NAME`/`CSC_LINK` only. `mac.forceCodeSigning: true` documents the same guarantee for local builds.

## Where the signing secrets come from

Signing and notarization secrets come from two Apple artifacts plus one local
password. Getting them is a one-time, ~30 minute job — only
`MAC_CSC_LINK`/`MAC_CSC_KEY_PASSWORD` involve Keychain Access, and
`KEYCHAIN_PASSWORD` is not something you request from Apple at all.

| # | Secret | Where it comes from | Time |
| --- | --- | --- | --- |
| 1-2 | `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` | A **Developer ID Application** certificate: Apple Developer portal → *Certificates, Identifiers & Profiles* → `+` → *Developer ID — Application* (needs the Account Holder or Admin role) → Keychain Access → export the certificate **with its private key** as `.p12` | ~10 min |
| 3 | `KEYCHAIN_PASSWORD` | Nothing to request — generate one: `openssl rand -base64 32` | 0 min |
| 4 | `APPLE_TEAM_ID` | Developer portal *Membership* page, or the `(TEAMID)` in the certificate subject | 0 min |
| 5-7 | `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` | [App Store Connect](https://appstoreconnect.apple.com) → *Users and Access* → *Integrations* → *Team Keys* → generate a key (Admin or Developer). Download `AuthKey_<KEYID>.p8` once; copy the Key ID and Issuer UUID | ~5 min |

### 1-2. Developer ID Application certificate

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year) if you have not. Personal or organization account, both work.
2. Go to the [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list) page and click `+`.
3. Pick **Developer ID → Developer ID Application** (this is the only certificate type expected by the workflow). Not *Apple Development* — that one cannot sign a distributable app.
4. Follow the *Create a Certificate Signing Request* guide with **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority** (choose *Saved to disk*). Upload the `.certSigningRequest`.
5. Download the `.cer`, double-click it to install it into your login keychain, or do it from the portal.
6. Expand the certificate in Keychain Access so the **private key** is visible, select both, *Export 2 Items…* → `.p12`, and give it a password. That password is `MAC_CSC_KEY_PASSWORD`.
7. Base64-encode it:

   ```bash
   base64 -i DeveloperIDApplication.p12 | tr -d '\n' > csc_link.b64
   # macOS < 14: base64 -i DeveloperIDApplication.p12 | pbcopy
   ```

   Put the single-line output into `MAC_CSC_LINK`, and the export password from step 6 into `MAC_CSC_KEY_PASSWORD`.

   With an existing `.p12` you can also point `MAC_CSC_LINK` at an `https://` URL — useful if you keep it in a private bucket.

### 3. `KEYCHAIN_PASSWORD`

Not an Apple artifact. It is the password of the throwaway keychain the CI job
creates to import the `.p12`; the certificate then never touches the runner's
login keychain. Generate any strong random value and store it as a secret — it
never leaves the job.

```bash
openssl rand -base64 32
```

### 4. `APPLE_TEAM_ID`

The 10-character team ID on the Developer portal *Membership* page, or in
Keychain Access under the certificate subject: `Developer ID Application: … (TEAMID)`.

### 5-7. App Store Connect Team API key

Notarization authenticates with a **Team** API key (not an Apple ID, and not
an Individual key — Individual keys omit the issuer and electron-builder will
not pick them up).

1. Open [App Store Connect](https://appstoreconnect.apple.com) → *Users and Access* → *Integrations* → *Team Keys*.
2. Create a key with at least **Developer** access. You can download the `.p8` **once**.
3. Store:
   - `APPLE_API_KEY_ID` — the 10-character Key ID
   - `APPLE_API_ISSUER` — the Issuer UUID shown on that page
   - `APPLE_API_KEY` — either the PEM text of `AuthKey_<KEYID>.p8`, or `base64 -i AuthKey_<KEYID>.p8 | tr -d '\n'`

Revoking the key in App Store Connect invalidates notarization until you
generate a new key and update the three secrets. It does not require a new
Developer ID certificate.

### Putting them into GitHub

GitHub repo → *Settings → Secrets and variables → Actions → New repository secret*, one per secret name. Nothing needs to be committed to the repo. If your account/organization already has these under a shared name, reuse them and skip this section.

To verify the certificate is the right kind before pushing a tag:

```bash
security find-identity -v -p codesigning        # after importing the .p12 locally
# → 1) ABC123... "Developer ID Application: Your Name (TEAMID)"
```

### Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Check signing secrets` fails listing names | That secret is empty/typoed in the repo settings |
| Job fails with `no identity found` | The `.p12` is *Apple Development* or *Apple Distribution*, not **Developer ID Application** — the workflow prints the identities it did find |
| `security: SecKeychainItemImport: MAC verification failed` | Wrong `MAC_CSC_KEY_PASSWORD`, or the `.p12` was exported without its private key |
| Notarization fails with `401` / `Unable to authenticate` | Wrong `APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER`, or an Individual key was used (omit-issuer keys are not supported — use a Team key) |
| Notarization returns `Invalid` + `The signature does not include a secure timestamp` | Not this setup — that would be a packaging bug; the workflow passes `--timestamp` via Hardened Runtime |

## License

MIT
