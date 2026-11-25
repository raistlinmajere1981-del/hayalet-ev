# Gaia project storage v1

The four room-UI commands use the invoking webview's partition and top-level document. The host dispatches the request ID through SlotBridge. The preload retains the payload until dispatch and submits it from that webview. The application build supplies the trusted provider.

- GaiaProjects lists project IDs.
- GaiaCreate accepts project, fixture and locale. The room supplies `layout: "site"` for an empty standard project or the full site fixture. The original request shape still uses the prior starter model. Creation never replaces a saved world.
- GaiaOpen accepts project and an optional building ID. An explicit building must have a floor. Without a building, the response identifies the first editable building if one exists, and always issues a project session.
- GaiaSave accepts batch and retry. Both site and interior batches carry project, session, baseRevision, operationId and edits. An interior batch carries the authorized building ID. A site batch carries `scope: "site"`. Success returns the committed world. An exact replay can recover the last successful receipt. A different successful edit supersedes it. Reopen to resolve an older unknown result.

The site batch supports adding a site, building, floor, mount or utility line, binding a virtual device, setting the boundary, building pose and dimensions, floor elevation, mount position and path vertices, reparenting and explicit removal. Building transforms carry the local frames of descendants. Reparenting requires a choice of world or local pose preservation. Path vertices remain in the path's own frame. Removal names every removed node and detached device and rejects surviving parent, zone and reference dependencies. Detached devices remain in inventory under their original IDs.

World and receipt share one atomic publication. Missing PNG files are reported alongside the world. Opening a damaged world fails. Virtual readings live in the UI session and do not enter the storage command.
