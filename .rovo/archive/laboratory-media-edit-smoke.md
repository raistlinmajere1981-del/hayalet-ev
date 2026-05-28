# Laboratory Media Edit Stage Smoke

1. Open the laboratory media analysis room and capture a real source into a project.
2. Move to `Edit`, open settings, and confirm `FFmpeg` appears under the current-stage tools with `Required` support while non-edit tools stay in the secondary list with the correct non-current-stage support label.
3. Start a preview job, cancel it with `Cancel preview`, and confirm the job clears without corrupting the active recipe or output list.
4. Start an apply job, cancel it with `Cancel apply`, and confirm the job clears without removing the last completed preview or output entry.
5. Switch between `Beginner` and `Advanced` and verify the visible controls change without breaking the preview surface.
6. Apply a preset, change one recipe field, and confirm the summary updates immediately.
7. Generate a preview and confirm a file appears under `data/room-storage/laboratory/projects/<project>/derived/edit/preview/`.
8. Render a derived output and confirm a file appears under `data/room-storage/laboratory/projects/<project>/derived/edit/output/`.
9. Select the derived output, switch handoff to `Use derived output`, and confirm the report stage shows the derived media instead of the source.
10. Return to `Source`, replace the source file, then re-open `Edit` and confirm the recipe/output state resets for the new source.
11. Confirm `data/rooms/laboratory/host/index.js` and `data/rooms/laboratory/ui/index.js` match the workspace copies after the latest room sync or reinstall.
