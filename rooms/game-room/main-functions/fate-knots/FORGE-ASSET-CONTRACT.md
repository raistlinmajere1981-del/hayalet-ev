# Fate Knots — World Forge Asset Contract

This document constrains asset-generation work for Fate Knots. It supplements the main rebuild contract and exists so local visual implementation does not redesign the Forge pipeline.

## Ownership

AI0 remains the NPC actor service. It is not the image-generation authority.

World Forge owns image-generation requests through a dedicated image/provider adapter. Generated candidates become engine-managed assets only after the Forge pipeline accepts and stores them.

## Prefer reusable composition over generated UI

Image generation should primarily create visual material that benefits from illustration:

- card illustrations
- character/NPC portraits
- item illustrations
- scene illustrations
- book/table/background material
- map art/style material
- decorative motifs when useful

Do not ask the image model to bake precise gameplay UI into an illustration when Fate Knots can render that UI deterministically.

In particular, card generation should normally separate:

`generated card art` + `theme card frame` + `engine-rendered title/rules/icons/state`

This keeps typography, mechanical information, selection state and accessibility under renderer control.

## Canonical card-art binding

A generated card illustration becomes a normal `FateKnotsAssetRef` after extraction/storage.

The canonical card may reference that illustration through:

`FateKnotsCardDefinition.artAssetId`

Rules:

- `artAssetId` is optional; a card without generated art remains valid
- when present, it must reference an accepted asset in the same Universe Package
- `artAssetId` points to illustration material only, not a fully rendered card UI
- `sourceId` keeps its existing semantic/mechanical purpose and must not be reused as an art pointer
- the gameplay renderer receives an art asset path only when that card is player-visible/referenced by the current safe gameplay projection
- opposition hidden-card artwork must not be exposed merely because the enemy exists in combat

The final canonical World Forge gate validates the optional card-art reference before an accepted universe can be persisted through the normal Forge path.

## Batch image sheets

World Forge may reduce provider calls by requesting several related illustrations in one generated image sheet.

V1 supports at most eight cells per sheet. Six or eight cells are preferred for card-art batches when image quality remains acceptable.

Recommended examples:

- `2 x 3` -> six card illustrations
- `2 x 4` or `4 x 2` -> eight card illustrations

The source image must be requested as a strict equal-cell grid with one self-contained subject per cell.

Prompt requirements for batch mode:

- same universe art direction across the sheet
- one independent illustration per cell
- clear visual separation/gutter between cells
- no typography
- no card frame
- no gameplay UI icons
- no subject crossing cell boundaries
- enough internal safe area for a small crop inset

The headless contract and normalized crop math live in `forge/image-sheet.ts`.

The eventual provider/image adapter is responsible for:

1. generating the source sheet
2. storing the source sheet for provenance/debug when useful
3. converting normalized cell crop rectangles to pixels
4. extracting each accepted cell into a normal individual asset file
5. registering each extracted file under its own asset ID
6. binding an accepted card illustration asset to the intended canonical card through `artAssetId`

Runtime rendering should consume the extracted individual assets. Runtime should not need to understand the original provider sheet.

## Failure and regeneration

Batching is an optimization, not an all-or-nothing dependency.

If one cell is poor while the other cells are useful, Forge should keep the accepted cells and regenerate only the failed content as either:

- a replacement cell in a later batch, or
- a single-image request

Do not discard seven useful card illustrations because one cell failed.

Likewise, content that needs unusually high detail may bypass sheet mode and use a single generation.

## Why this boundary exists

The optimization is valuable only if it reduces generation traffic without making runtime or visual correction harder.

Therefore:

- image models create artwork
- Fate Knots creates exact card/UI composition
- the extraction adapter creates normal assets
- canonical card data binds only to extracted normal asset IDs
- engine/card mechanics remain independent from provider-specific image layout

This lets the batch strategy change later without changing combat rules, card semantics, or the Babylon book renderer.
