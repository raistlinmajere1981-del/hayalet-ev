# Fate Knots — Concrete Asset Materializer Handoff

This is the bounded local/Codex task that remains between the headless World Forge pipeline and real generated artwork.

Read first:

- `README.md`
- `CODEX-HANDOFF.md`
- `FORGE-ASSET-CONTRACT.md`
- `forge/materializer.ts`
- `forge/image-sheet.ts`
- `host/forge-service.ts`

Do not redesign World Forge while implementing this adapter.

## Exact integration point

Implement one concrete `FateKnotsAssetMaterializerAdapter` and register it through:

`registerFateKnotsAssetMaterializer(adapter)`

from `host/forge-service.ts`.

When no adapter is registered, World Forge intentionally remains blocked and the Neutral Hub reports `asset-materializer-unavailable`.

Do not add a fake/dry materializer that returns paths for files that do not exist.

## Provider boundary

The adapter may use an image-capable Hayalet Ev provider/webview, but provider-specific DOM/session logic must stay outside the headless Forge modules.

Useful existing infrastructure to reuse where appropriate:

- `src/js/modules/webview/providers/shared/generated-image-extractor.ts`
- generated-image extraction/persistence patterns in `src/js/modules/webview/conversation-syncer.ts`
- provider-tester image extraction code under `electron/provider-tester/`

Those helpers prove that generated provider images can already be located and converted to bytes. Reuse or wrap that capability rather than building a second unrelated scraper when possible.

The adapter receives only a `single` or `sheet` materializer job. It does not need the full canonical Universe Package.

Do not route this through the isolated Fate AI0 NPC runtime. AI0 runtime intentionally has no image-generation authority.

## Single job

For `job.kind === "single"`:

1. send `job.prompt` to the configured image-capable provider
2. wait for one newly generated image belonging to that request
3. extract real image bytes
4. persist them under Fate Knots room storage
5. return exactly one `FateKnotsMaterializedAsset` using `job.plan.assetId`

The returned `path` must point to a real local stored image file under the managed Fate Knots asset tree. Do not return:

- provider CDN URLs
- `data:` URLs
- blob URLs
- pending Forge URIs
- paths outside `room-storage/game-room/fate-knots/assets/`
- guessed/nonexistent paths

A reasonable storage shape is:

`room-storage/game-room/fate-knots/assets/<request-or-job>/<assetId>.<ext>`

Exact private helper names and directory nesting may vary as long as canonical returned paths are stable local files.

The host verifies managed-path containment, readable non-empty bytes, and an `image/*` MIME type before canonical finalization. Adapter success records that fail this boundary are rejected.

## Sheet job

For `job.kind === "sheet"`:

1. generate one source image with `job.prompt`
2. persist the source sheet for provenance/debug
3. obtain each cell's normalized rectangle from the canonical sheet definition
4. convert normalized rectangles to source-image pixel rectangles
5. crop each cell independently
6. persist each crop as a normal individual asset file using its exact `outputAssetId`
7. return the individual assets plus optional `sourceArtifact`

Use the geometry from `forge/image-sheet.ts`. Do not infer a different grid from visual content.

`plan.aspectRatio` describes each requested individual asset/cell. For a sheet, `job.aspectRatio` is the overall source-sheet ratio already derived by the engine from:

`(columns × cellWidth) : (rows × cellHeight)`

For example, six `3:4` cells in a `3 × 2` grid require a source sheet whose overall ratio is `9:8`, not `3:4`. Send the provider `job.aspectRatio`; do not substitute the first cell's ratio or independently recalculate a different layout.

The source sheet is not a runtime asset dependency. Babylon/card rendering consumes only the extracted individual files.

Prefer an already-available browser/Electron image primitive for cropping before adding a new heavyweight native dependency. If a new dependency becomes necessary, keep it confined to the provider/materializer implementation and do not leak it into the Fate Knots rules engine.

## Partial sheet success

`forge/materializer.ts` preserves successful prior jobs and reports missing asset IDs, but malformed provider responses fail closed.

If a provider/extraction step can confidently recover some cells and not others, return the valid stored cells. Missing cells will remain failures and may later be regenerated individually.

Never manufacture a successful asset record for a failed crop.

A job response containing a foreign asset ID or the same asset ID more than once is malformed. Do not rely on the orchestrator to silently discard those records; the materializer authority treats them as failures.

## Asset identity

The adapter must never rename asset IDs.

For a single job:

`returned.assetId === job.plan.assetId`

For a sheet job, every returned asset ID must be one of the job's planned output IDs and each planned ID may appear at most once.

World Forge finalization rejects missing/foreign/duplicate assets.

Card-art identity remains canonical through asset tags such as:

`card-art:<cardId>`

The adapter does not rewrite card data or card-art bindings.

## File/provenance expectations

Persist enough information to diagnose provider failures without making provenance part of gameplay mechanics.

Useful source artifact metadata:

- job ID
- local source image path
- MIME type

The existing World Forge checkpoint already stores request/draft/materialization metadata. Do not duplicate the full hidden Universe Package into renderer-visible state.

The canonical Universe Package is the commit point. A later provenance/checkpoint write failure is retryable bookkeeping and must not make an already-saved universe appear to have failed or disappeared.

## No baked UI

Generated images are visual material only.

Do not ask the provider to bake exact:

- card title text
- rules text
- HP/energy values
- priority labels
- inventory counts
- target markers
- buttons
- page UI

Those remain deterministic renderer composition.

## Failure behavior

Fail closed.

If provider generation, extraction, crop, storage, managed-path verification, or output identity validation fails:

- throw or return no asset for the failed output
- leave the Forge pipeline incomplete
- preserve already stored valid outputs when practical
- do not activate or save a canonical universe with unresolved pending assets

Do not silently fall back to placeholder art during canonical World Forge completion. Placeholder/debug assets may exist in tests, but they must not make a failed production Forge transaction look complete.

## First local verification after implementation

Verify these cases before visual polish:

1. one single asset generates and is stored under the managed Fate Knots asset tree
2. one 6-cell sheet uses the engine-supplied overall sheet ratio and produces six independent local files
3. one 8-cell sheet uses the engine-supplied overall sheet ratio and produces eight independent local files
4. one intentionally missing sheet cell leaves Forge incomplete while preserving valid cells
5. duplicate or foreign returned asset IDs fail the job rather than being silently ignored
6. returned asset IDs remain exactly the planned IDs
7. final canonical Universe Package contains readable local `image/*` files and no `fate-knots-pending://` paths
8. restarting Hayalet Ev still loads the forged universe from the single durable Fate Knots state envelope
9. isolated Fate AI0 NPC runtime remains untouched by image generation

After these checks, renderer/Babylon work may treat generated assets as ordinary local universe assets.
