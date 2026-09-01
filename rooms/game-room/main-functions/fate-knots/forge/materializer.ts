import {
  FATE_KNOTS_IMAGE_SHEET_PROMPT_RULES,
  type FateKnotsImageSheetDefinition,
  type FateKnotsImageSheetPurpose,
} from "./image-sheet.js";
import type {
  FateKnotsForgeAspectRatio,
  FateKnotsMaterializedAsset,
  FateKnotsWorldForgeAssetPlan,
  FateKnotsWorldForgeDraft,
} from "./world-forge.js";

export const FATE_KNOTS_MATERIALIZER_MAX_SHEET_CELLS = 8;
export const FATE_KNOTS_MATERIALIZER_MIN_SHEET_CELLS = 4;
export const FATE_KNOTS_MATERIALIZER_PREFERRED_SHEET_MIN = 6;

export interface FateKnotsSourceAspectRatio {
  width: number;
  height: number;
}

export interface FateKnotsSingleImageMaterializerJob {
  kind: "single";
  jobId: string;
  plan: FateKnotsWorldForgeAssetPlan;
  prompt: string;
  aspectRatio: FateKnotsForgeAspectRatio;
}

export interface FateKnotsSheetImageMaterializerJob {
  kind: "sheet";
  jobId: string;
  plans: FateKnotsWorldForgeAssetPlan[];
  prompt: string;
  /** Aspect of each extracted cell. */
  cellAspectRatio: FateKnotsForgeAspectRatio;
  /** Aspect the provider must generate for the complete grid source. */
  sourceAspectRatio: FateKnotsSourceAspectRatio;
  sheet: FateKnotsImageSheetDefinition;
}

export type FateKnotsAssetMaterializerJob =
  | FateKnotsSingleImageMaterializerJob
  | FateKnotsSheetImageMaterializerJob;

export interface FateKnotsMaterializerSourceArtifact {
  jobId: string;
  path: string;
  mimeType?: string | null;
}

export interface FateKnotsMaterializerJobResult {
  assets: FateKnotsMaterializedAsset[];
  sourceArtifact?: FateKnotsMaterializerSourceArtifact | null;
}

/**
 * Provider-specific image generation, crop and storage live behind this adapter.
 * The engine provides exact asset ids and sheet geometry; adapters may not rename
 * assets or turn a source sheet into a runtime dependency.
 */
export interface FateKnotsAssetMaterializerAdapter {
  materialize(job: FateKnotsAssetMaterializerJob): Promise<FateKnotsMaterializerJobResult>;
}

export interface FateKnotsMaterializerFailure {
  jobId: string;
  assetIds: string[];
  message: string;
}

export interface FateKnotsAssetMaterializationResult {
  complete: boolean;
  assets: FateKnotsMaterializedAsset[];
  sourceArtifacts: FateKnotsMaterializerSourceArtifact[];
  failures: FateKnotsMaterializerFailure[];
}

function sanitizeId(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "asset";
}

function purposeForPlan(plan: FateKnotsWorldForgeAssetPlan): FateKnotsImageSheetPurpose | null {
  if (plan.kind === "portrait") return "portrait";
  if (plan.kind === "icon") return "icon-art";
  if (plan.kind === "scene" || plan.kind === "transition") return "scene-detail";
  if (plan.kind === "other") return "card-art";
  return null;
}

function batchCompatibilityKey(plan: FateKnotsWorldForgeAssetPlan): string | null {
  const group = plan.batchGroup?.trim() ?? "";
  const purpose = purposeForPlan(plan);
  if (group === "" || purpose === null) return null;
  return `${group}\u0000${plan.aspectRatio}\u0000${purpose}`;
}

function gridForCellCount(count: number): { columns: number; rows: number } {
  if (count <= 4) return { columns: 2, rows: 2 };
  if (count <= 6) return { columns: 3, rows: 2 };
  return { columns: 4, rows: 2 };
}

function aspectComponents(aspectRatio: FateKnotsForgeAspectRatio): { width: number; height: number } {
  if (aspectRatio === "3:4") return { width: 3, height: 4 };
  if (aspectRatio === "4:3") return { width: 4, height: 3 };
  if (aspectRatio === "16:9") return { width: 16, height: 9 };
  return { width: 1, height: 1 };
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

export function getFateKnotsSheetSourceAspectRatio(
  cellAspectRatio: FateKnotsForgeAspectRatio,
  columns: number,
  rows: number
): FateKnotsSourceAspectRatio {
  const cell = aspectComponents(cellAspectRatio);
  const width = cell.width * columns;
  const height = cell.height * rows;
  const divisor = gcd(width, height);
  return { width: width / divisor, height: height / divisor };
}

function buildSheetPrompt(plans: readonly FateKnotsWorldForgeAssetPlan[]): string {
  const cellLines = plans.map(
    (plan, index) => `Cell ${index + 1} (asset ${plan.assetId}): ${plan.prompt.trim()}`
  );
  return [
    "Generate one illustration sheet using this strict layout contract:",
    ...FATE_KNOTS_IMAGE_SHEET_PROMPT_RULES.map((rule) => `- ${rule}`),
    "Use reading order left-to-right, then top-to-bottom.",
    "Each listed cell is independent and must remain visually self-contained.",
    ...cellLines,
  ].join("\n");
}

function createSheetJob(
  draft: FateKnotsWorldForgeDraft,
  plans: FateKnotsWorldForgeAssetPlan[],
  ordinal: number
): FateKnotsSheetImageMaterializerJob {
  const purpose = purposeForPlan(plans[0] as FateKnotsWorldForgeAssetPlan) ?? "card-art";
  const { columns, rows } = gridForCellCount(plans.length);
  const jobId = `${draft.requestId}:sheet:${ordinal}`;
  const cellAspectRatio = plans[0]?.aspectRatio ?? "1:1";
  const sheet: FateKnotsImageSheetDefinition = {
    sheetId: jobId,
    purpose,
    sourceAssetId: `${jobId}:source`,
    columns,
    rows,
    safeInsetRatio: 0.025,
    cells: plans.map((plan, index) => ({
      slotId: `cell-${index + 1}`,
      contentRefId: plan.assetId,
      outputAssetId: plan.assetId,
      row: Math.floor(index / columns),
      column: index % columns,
    })),
  };
  return {
    kind: "sheet",
    jobId,
    plans: plans.map((plan) => ({ ...plan })),
    prompt: buildSheetPrompt(plans),
    cellAspectRatio,
    sourceAspectRatio: getFateKnotsSheetSourceAspectRatio(cellAspectRatio, columns, rows),
    sheet,
  };
}

function createSingleJob(
  draft: FateKnotsWorldForgeDraft,
  plan: FateKnotsWorldForgeAssetPlan,
  ordinal: number
): FateKnotsSingleImageMaterializerJob {
  return {
    kind: "single",
    jobId: `${draft.requestId}:single:${ordinal}:${sanitizeId(plan.assetId)}`,
    plan: { ...plan },
    prompt: plan.prompt.trim(),
    aspectRatio: plan.aspectRatio,
  };
}

/**
 * Deterministically converts validated asset plans into provider-neutral jobs.
 * Compatible batch groups prefer 6-8 cells. Four or five compatible leftovers
 * still use a sheet when that avoids extra provider calls. A one-to-three tail
 * becomes single generation when rebalancing would force the leading sheet below
 * the preferred six-cell quality/efficiency range.
 */
export function planFateKnotsAssetMaterialization(
  draft: FateKnotsWorldForgeDraft
): FateKnotsAssetMaterializerJob[] {
  const jobs: FateKnotsAssetMaterializerJob[] = [];
  const grouped = new Map<string, FateKnotsWorldForgeAssetPlan[]>();
  const singles: FateKnotsWorldForgeAssetPlan[] = [];

  for (const plan of draft.assetPlans) {
    const key = batchCompatibilityKey(plan);
    if (!key) {
      singles.push(plan);
      continue;
    }
    const group = grouped.get(key) ?? [];
    group.push(plan);
    grouped.set(key, group);
  }

  let sheetOrdinal = 0;
  let singleOrdinal = 0;
  for (const plans of grouped.values()) {
    let offset = 0;
    while (plans.length - offset >= FATE_KNOTS_MATERIALIZER_MIN_SHEET_CELLS) {
      const remaining = plans.length - offset;
      const take = Math.min(FATE_KNOTS_MATERIALIZER_MAX_SHEET_CELLS, remaining);
      const tail = remaining - take;
      const rebalancedTake =
        tail > 0 && tail < FATE_KNOTS_MATERIALIZER_MIN_SHEET_CELLS
          ? take - (FATE_KNOTS_MATERIALIZER_MIN_SHEET_CELLS - tail)
          : take;
      const adjustedTake =
        rebalancedTake >= FATE_KNOTS_MATERIALIZER_PREFERRED_SHEET_MIN
          ? rebalancedTake
          : take;
      const chunk = plans.slice(offset, offset + adjustedTake);
      sheetOrdinal += 1;
      jobs.push(createSheetJob(draft, chunk, sheetOrdinal));
      offset += adjustedTake;
    }
    for (const plan of plans.slice(offset)) singles.push(plan);
  }

  for (const plan of singles) {
    singleOrdinal += 1;
    jobs.push(createSingleJob(draft, plan, singleOrdinal));
  }

  return jobs;
}

function expectedAssetIds(job: FateKnotsAssetMaterializerJob): string[] {
  return job.kind === "single" ? [job.plan.assetId] : job.plans.map((plan) => plan.assetId);
}

/**
 * Executes jobs sequentially to avoid accidental provider bursts. Partial success
 * is retained, but duplicate/foreign outputs are explicit failures rather than
 * being silently ignored or overwritten in a Map.
 */
export async function materializeFateKnotsWorldForgeAssets(
  draft: FateKnotsWorldForgeDraft,
  adapter: FateKnotsAssetMaterializerAdapter
): Promise<FateKnotsAssetMaterializationResult> {
  const assetsById = new Map<string, FateKnotsMaterializedAsset>();
  const sourceArtifacts: FateKnotsMaterializerSourceArtifact[] = [];
  const failures: FateKnotsMaterializerFailure[] = [];
  const jobs = planFateKnotsAssetMaterialization(draft);

  for (const job of jobs) {
    const expectedIds = expectedAssetIds(job);
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await adapter.materialize(job);
      const expected = new Set(expectedIds);
      const jobSeen = new Set<string>();

      for (const rawAsset of result.assets) {
        const assetId = rawAsset.assetId.trim();
        const path = rawAsset.path.trim();
        if (assetId === "" || path === "") {
          failures.push({ jobId: job.jobId, assetIds: assetId ? [assetId] : [], message: "Materializer returned an empty asset id or path." });
          continue;
        }
        if (jobSeen.has(assetId)) {
          failures.push({ jobId: job.jobId, assetIds: [assetId], message: "Materializer returned a duplicate asset id in one job." });
          continue;
        }
        jobSeen.add(assetId);
        if (!expected.has(assetId)) {
          failures.push({ jobId: job.jobId, assetIds: [assetId], message: "Materializer returned a foreign asset id." });
          continue;
        }
        if (assetsById.has(assetId)) {
          failures.push({ jobId: job.jobId, assetIds: [assetId], message: "Materializer returned an asset id already produced by another job." });
          continue;
        }
        assetsById.set(assetId, {
          ...rawAsset,
          assetId,
          path,
          ...(rawAsset.mimeType !== undefined && rawAsset.mimeType !== null
            ? { mimeType: rawAsset.mimeType.trim() }
            : {}),
        });
      }

      if (result.sourceArtifact) {
        const sourcePath = result.sourceArtifact.path.trim();
        if (result.sourceArtifact.jobId !== job.jobId || sourcePath === "") {
          failures.push({ jobId: job.jobId, assetIds: expectedIds, message: "Materializer returned an invalid source artifact identity/path." });
        } else {
          sourceArtifacts.push({ ...result.sourceArtifact, path: sourcePath });
        }
      }

      const missing = expectedIds.filter((assetId) => !assetsById.has(assetId));
      if (missing.length > 0) {
        failures.push({
          jobId: job.jobId,
          assetIds: missing,
          message: "Materializer returned no stored output for one or more expected assets.",
        });
      }
    } catch (error) {
      failures.push({
        jobId: job.jobId,
        assetIds: expectedIds,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const expectedAll = new Set(draft.assetPlans.map((plan) => plan.assetId));
  const assets = Array.from(assetsById.values());
  return {
    complete:
      failures.length === 0 &&
      assets.length === expectedAll.size &&
      assets.every((asset) => expectedAll.has(asset.assetId)),
    assets,
    sourceArtifacts,
    failures,
  };
}
