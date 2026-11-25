# Gaia project storage v1

The room-UI commands use the invoking webview's partition and top-level document. The host dispatches the request ID through SlotBridge. The preload retains the payload until dispatch and submits it from that webview. The application build supplies the trusted provider.

- GaiaProjects lists project IDs.
- GaiaCreate accepts project, fixture and locale. The room supplies `layout: "site"` for an empty standard project or the full site fixture. The original request shape still uses the prior starter model. Creation never replaces a saved world.
- GaiaOpen accepts project and an optional building ID. An explicit building must have a floor. Without a building, the response identifies the first editable building if one exists, and always issues a project session.
- GaiaSave accepts batch and retry. Both site and interior batches carry project, session, baseRevision, operationId and edits. An interior batch carries the authorized building ID. A site batch carries `scope: "site"`. A reference batch carries `scope: "reference"` and one edit with `op` set to `import`, `replace`, `appearance`, `calibrate` or `remove`. Success returns the committed world. An exact replay can recover the last successful receipt. A different successful edit supersedes it. Reopen to resolve an older unknown result.

- GaiaReference accepts project, session and a linked asset ID. It returns a bounded, reproducible raster preview for the active webview session.

The site batch supports adding a site, building, floor, mount or utility line, binding a virtual device, setting the boundary, building pose and dimensions, floor elevation, mount position and path vertices, reparenting and explicit removal. Building transforms carry the local frames of descendants. Reparenting requires a choice of world or local pose preservation. Path vertices remain in the path's own frame. Removal names every removed node and detached device and rejects surviving parent, zone and reference dependencies. Detached devices remain in inventory under their original IDs.

New image assets keep their original bytes, detected format, original pixel dimensions and SHA-256. Import and replacement send bytes as base64 and supply fresh asset IDs. A new asset is published before the world and receipt are atomically replaced. The writer retires the previous asset after publication when its last reference is gone. No client supplies a disk path.

A reference can use project coordinates or a site, building, floor or zone frame. Rebinding preserves the world placement of a calibrated image. Replacing the image clears its calibration. The placement lock must be released before calibration, rebinding, replacement or removal. Visibility and opacity can still be changed. Geometry edits and reference edits keep their own scope.

A missing or damaged image is reported alongside the world and retains its reference record. A damaged world cannot be opened. Virtual readings and temporary measurements live in the UI session. OpenPlan3D receives the active floor’s projected underlays as ephemeral render inputs.
