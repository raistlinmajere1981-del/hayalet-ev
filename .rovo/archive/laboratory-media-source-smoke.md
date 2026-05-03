# Laboratory Media Source Smoke Checklist

## Tooling
- Open the laboratory room and confirm the `source` stage loads without dummy-only blockers.
- Open the settings overlay from the stage rail.
- Verify `yt-dlp` and `ffmpeg` status rows render.
- If either tool is missing, run install and wait for completion.
- Run `Refresh Tools` and confirm version/path fields update.

## Project Flow
- Create a new project and confirm an auto-generated name appears.
- Switch to an older project and confirm the saved source snapshot restores.
- Delete a non-critical project and confirm it disappears from the selector.

## Source Intake
- `image/local`: copy a local image and confirm preview renders from the project-owned file.
- `audio/local`: copy a local audio file and confirm native audio controls appear.
- `video/local`: copy a local video and confirm native video controls appear.
- `url`: download a direct media URL and confirm preview waits until the file is saved.
- `url` invalid case: try an HTML page URL and confirm the source does not end in `ready`.
- `video/youtube` missing-tool case: confirm the YouTube option is disabled when `yt-dlp` is unavailable.
- `video/youtube` installed case: run one preset download and confirm the file lands in the project `source` folder.

## Metadata And Correlation
- With `ffmpeg/ffprobe` installed, confirm preview info shows persisted metadata such as duration, resolution, codec, format, or bitrate when available.
- Trigger one source acquisition, then immediately trigger a newer acquisition in the same domain and confirm stale progress/action messages do not replace the newer request state.
- After installing `ffmpeg` for an existing project, refresh tools or reselect the project and confirm metadata backfills when possible.

## Portability
- Export an installed room back to workspace and confirm `tools/runtime/**` is not copied out.
- Reopen the room after reload and confirm the active project and source snapshot survive.
