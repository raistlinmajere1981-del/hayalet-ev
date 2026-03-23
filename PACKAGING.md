# Packaging

This project ships with two first-class desktop artifacts:

- Windows: portable executable
- Linux: AppImage

## Commands

```bash
npm run dist:win
npm run dist:linux
npm run dist:all
```

Artifacts are written to the `release/` directory.

## Build flow

Each distribution command runs `npm run build:all` first, then invokes `electron-builder` with
`electron-builder.yml`.

## Current targets

- Windows `portable`
- Linux `AppImage`

## Included runtime content

The packaging config currently includes:

- `dist/**/*`
- `rooms/**/*`
- `src/assets/**/*`
- `.rovo/_metadata/**/*`

## Native and external dependencies

- `better-sqlite3` is unpacked from ASAR because it is a native module.
- Linux-only automation helpers may still require system packages such as `xdotool` and `xclip`.
- Video analysis features currently rely on `ffmpeg` and `ffprobe` being available on the host system.
- Laboratory YouTube source preparation relies on `yt-dlp` `2025.11.12+`; a user-local install such as `~/.local/bin/yt-dlp` is preferred over stale system packages when both exist.
- For current YouTube extraction behavior, the selected `yt-dlp` build should include `yt-dlp-ejs` support and a supported JS runtime such as `node` 20+ or `deno`.

## Validation checklist

1. Build the target artifact.
2. Launch the packaged app.
3. Verify the main window opens.
4. Verify settings can be created and persisted.
5. Verify SQLite-backed flows open without runtime module errors.

## Known follow-up items

- Add platform-specific icons (`.ico` for Windows, optional larger Linux icon set).
- Validate packaged provider config loading in a real artifact.
- Confirm Linux AppImage writable-path behavior for `config/`, `data/`, and `logs/`.
