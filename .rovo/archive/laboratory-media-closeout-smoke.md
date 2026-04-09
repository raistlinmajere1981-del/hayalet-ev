# Laboratory Media Closeout Smoke

## Media Analysis

- Create a new project and confirm `source`, `derived`, `profile`, `process`, and `report` folders appear under `data/room-storage/laboratory/projects/<slug>/`.
- Add a local video source, verify the preview loads, and confirm the saved source lives inside the project folder.
- Open `Edit`, create a derived output, preview it, apply it, and confirm the selected handoff target changes the downstream summary.
- Open `Profile`, run preflight, and confirm the target, lanes, warnings, and artifacts refresh from host-backed state.
- Open `Process`, start a run, verify progress rows advance without any UI-only timer behavior, then cancel and rerun once.
- Open `Report`, verify findings and exports stay empty before a completed run, then export after a successful run and confirm a Markdown file appears under `reports/`.
- Reopen the room and confirm the latest process/report state survives reload.

## Audio Analysis

- Switch to `Audio Analysis` and confirm the same project can be reused with audio-focused copy.
- Run an audio-oriented process pass and verify implemented modules produce findings/artifacts while planned modules remain clearly labeled.
- Export an audio report and confirm it is stored under the same project-owned `reports/` directory.

## Settings And Portability

- Open settings on `source`, `profile`, `process`, and `report` stages and confirm unsupported tools do not appear in the active-stage section.
- On `report`, confirm the overlay explains that no dedicated tool is required and still lists the other room tools below.
- Sync or reinstall the room package and confirm the installed copy matches workspace files before rerunning a process/report smoke pass.
