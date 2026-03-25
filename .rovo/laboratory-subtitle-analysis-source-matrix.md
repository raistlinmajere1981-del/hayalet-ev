# Laboratory Subtitle Analysis Source Matrix

| Mode | Expected Input | Discovery | Import Result | Notes |
| --- | --- | --- | --- | --- |
| `local-file` | One `.srt/.vtt/.ass/.ssa` file | No | One subtitle entry | Discovery state resets |
| `local-folder` | Folder with subtitle files | No | Multiple subtitle entries | Partial copy failures should surface honestly |
| `url` | Direct subtitle URL | No | One subtitle entry | Extension inferred from URL when possible |
| `youtube-single` | One video URL | Yes | Selected subtitle files | Discovery still runs first for selection parity |
| `youtube-playlist` | Playlist URL | Yes | Selected subtitle files from selected videos | Supports date, weekday, duration, shorts, live, title filters |
| `youtube-channel` | Channel URL | Yes | Selected subtitle files from selected videos | Supports bulk selection and filter narrowing |

## Filters

- `subtitlesLang`: comma-separated languages or `all`
- `publishedAfter` / `publishedBefore`: ISO date fields
- `weekdays`: tokens such as `mon wed fri`
- `durationMinSeconds` / `durationMaxSeconds`
- `shortsMode`: `all`, `only`, `exclude`
- `liveMode`: `all`, `exclude-live`, `only-live`
- `titleInclude` / `titleExclude`: comma or newline separated terms
- `playlistItems`: yt-dlp playlist slice syntax
- `limitCount`: upper bound before discovery rows are materialized
