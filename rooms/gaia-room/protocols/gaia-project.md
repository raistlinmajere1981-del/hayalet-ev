# Gaia project storage v1

The four room-UI commands use the invoking webview's partition and top-level document. The host dispatches the request ID through SlotBridge. The preload retains the payload until dispatch and submits it from that webview. The application build supplies the trusted provider.

- GaiaProjects lists project IDs.
- GaiaCreate accepts project, fixture and locale. Creation never replaces a saved world.
- GaiaOpen accepts project and issues a workshop session for its editable building.
- GaiaSave accepts batch and retry. The batch carries project, building, session, baseRevision, operationId and edits. Success returns the committed world. An exact replay can recover the last successful receipt. A different successful edit supersedes it. Reopen to resolve an older unknown result.

World and receipt share one atomic publication. Missing PNG files are reported alongside the world. Opening a damaged world fails.
