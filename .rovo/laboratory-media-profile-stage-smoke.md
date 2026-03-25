# Laboratory Media Profile Stage Smoke

1. Open the laboratory media analysis room, create a project, and prepare a real source.
2. Move to `Edit`, render at least one derived output, and mark it as the active handoff candidate.
3. Move to `Profile`, open settings, and confirm `FFmpeg` appears under the current-stage tools as `Required`.
4. In the same settings overlay, confirm `Whisper.cpp` appears with `Optional` stage support and the transcript-model cards render in the profile-only section.
5. Switch between `Guided` and `Advanced` and verify the target panel, preset panel, and summary panel stay in sync.
6. Toggle the profile target between `Source asset` and `Derived output`; when `Derived output` is selected, confirm the output selector appears and the preview surface follows the chosen asset.
7. Apply a preset, then change one advanced field such as depth or sensitivity, and confirm the summary updates without losing the selected target.
8. Run `Preflight` and confirm profile artifacts appear under `data/room-storage/laboratory/projects/<project>/derived/profile/preflight/`.
9. If `Whisper.cpp` is available on the current platform, install a transcript model and confirm the preflight can add a transcript artifact without blocking other lanes.
10. Cancel a running preflight and confirm the job clears cleanly while the last completed signals and artifacts remain visible.
11. Replace the project source or render a new derived output, then re-open `Profile` and confirm the preflight state becomes stale and asks for a rerun.
12. Confirm `data/rooms/laboratory/host/index.js`, `data/rooms/laboratory/ui/index.js`, and the three profile tool descriptor files match the workspace copies after the latest room sync or reinstall.
