import {
  FATE_KNOTS_SCHEMA_VERSION,
  type FateKnotsAssetKind,
  type FateKnotsUniversePackage,
} from "../shared/contracts.js";
import { parseFateKnotsUniversePackage } from "./universe-boundary.js";
import { normalizeFateKnotsCanonicalUniversePackage } from "./canonical-universe.js";
import type { FateKnotsUniverseValidationIssue } from "./universe-validation.js";

export const FATE_KNOTS_WORLD_FORGE_SCHEMA_VERSION = 1;
export const FATE_KNOTS_PENDING_ASSET_SCHEME = "fate-knots-pending://";

export type FateKnotsForgeAspectRatio = "1:1" | "3:4" | "4:3" | "16:9";

export interface FateKnotsWorldForgeRequest {
  schemaVersion: typeof FATE_KNOTS_WORLD_FORGE_SCHEMA_VERSION;
  requestId: string;
  universeId: string;
  createdAt: string;
  brief?: string | null;
}

export interface FateKnotsWorldForgeAssetPlan {
  assetId: string;
  kind: Exclude<FateKnotsAssetKind, "audio">;
  prompt: string;
  aspectRatio: FateKnotsForgeAspectRatio;
  batchGroup?: string | null;
}

export interface FateKnotsWorldForgeDraftResponse {
  schemaVersion: typeof FATE_KNOTS_WORLD_FORGE_SCHEMA_VERSION;
  requestId: string;
  kind: "universe-draft";
  universe: unknown;
  assetPlans: unknown;
}

export interface FateKnotsWorldForgeDraft {
  schemaVersion: typeof FATE_KNOTS_WORLD_FORGE_SCHEMA_VERSION;
  requestId: string;
  universe: FateKnotsUniversePackage;
  assetPlans: FateKnotsWorldForgeAssetPlan[];
}

export interface FateKnotsMaterializedAsset {
  assetId: string;
  path: string;
  mimeType?: string | null;
}

export type FateKnotsWorldForgeIssueCode =
  | "invalid-response-root"
  | "unsupported-forge-schema-version"
  | "request-id-mismatch"
  | "universe-id-mismatch"
  | "created-at-mismatch"
  | "response-kind-mismatch"
  | "invalid-universe-package"
  | "invalid-asset-plan"
  | "duplicate-asset-plan"
  | "asset-plan-reference-missing"
  | "asset-plan-kind-mismatch"
  | "audio-generation-not-supported"
  | "asset-path-not-pending"
  | "materialized-asset-missing"
  | "duplicate-materialized-asset"
  | "materialized-path-invalid"
  | "final-universe-invalid";

export interface FateKnotsWorldForgeIssue {
  code: FateKnotsWorldForgeIssueCode;
  path: string;
  value?: string;
  validationIssues?: FateKnotsUniverseValidationIssue[];
}

export interface FateKnotsWorldForgeDraftResult {
  ok: boolean;
  draft: FateKnotsWorldForgeDraft | null;
  issues: FateKnotsWorldForgeIssue[];
}

export interface FateKnotsWorldForgeFinalizationResult {
  ok: boolean;
  universe: FateKnotsUniversePackage | null;
  issues: FateKnotsWorldForgeIssue[];
}

const ASPECT_RATIOS = new Set<FateKnotsForgeAspectRatio>(["1:1", "3:4", "4:3", "16:9"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readNullableTrimmedString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value.trim() || null : undefined;
}

function cloneUniverse(universe: FateKnotsUniversePackage): FateKnotsUniversePackage {
  return structuredClone(universe);
}

export function buildFateKnotsPendingAssetPath(assetId: string): string {
  return `${FATE_KNOTS_PENDING_ASSET_SCHEME}${encodeURIComponent(assetId.trim())}`;
}

export function isFateKnotsPendingAssetPath(path: string): boolean {
  return path.trim().startsWith(FATE_KNOTS_PENDING_ASSET_SCHEME);
}

export function buildFateKnotsWorldForgeRequest(
  requestId: string,
  universeId: string,
  createdAt: string,
  brief: string | null = null
): FateKnotsWorldForgeRequest {
  const normalizedRequestId = requestId.trim();
  const normalizedUniverseId = universeId.trim();
  const normalizedCreatedAt = createdAt.trim();
  if (normalizedRequestId === "") throw new Error("Fate Knots World Forge requestId is required.");
  if (normalizedUniverseId === "")
    throw new Error("Fate Knots World Forge universeId is required.");
  if (normalizedCreatedAt === "") throw new Error("Fate Knots World Forge createdAt is required.");
  const normalizedBrief = brief?.trim() ?? "";
  return {
    schemaVersion: FATE_KNOTS_WORLD_FORGE_SCHEMA_VERSION,
    requestId: normalizedRequestId,
    universeId: normalizedUniverseId,
    createdAt: normalizedCreatedAt,
    ...(normalizedBrief !== "" ? { brief: normalizedBrief } : {}),
  };
}

function parseAssetPlan(
  value: unknown,
  index: number,
  assetKindById: ReadonlyMap<string, FateKnotsAssetKind>,
  issues: FateKnotsWorldForgeIssue[]
): FateKnotsWorldForgeAssetPlan | null {
  const path = `assetPlans[${index}]`;
  if (!isRecord(value)) {
    issues.push({ code: "invalid-asset-plan", path });
    return null;
  }

  const assetId = readNonEmptyString(value["assetId"]);
  const kind = readNonEmptyString(value["kind"]);
  const prompt = readNonEmptyString(value["prompt"]);
  const aspectRatio = readNonEmptyString(value["aspectRatio"]);
  const batchGroup = readNullableTrimmedString(value["batchGroup"]);
  if (
    assetId === null ||
    kind === null ||
    prompt === null ||
    aspectRatio === null ||
    !ASPECT_RATIOS.has(aspectRatio as FateKnotsForgeAspectRatio) ||
    (value["batchGroup"] !== undefined && batchGroup === undefined)
  ) {
    issues.push({ code: "invalid-asset-plan", path });
    return null;
  }

  const canonicalKind = assetKindById.get(assetId);
  if (canonicalKind === undefined) {
    issues.push({ code: "asset-plan-reference-missing", path: `${path}.assetId`, value: assetId });
    return null;
  }
  if (canonicalKind === "audio") {
    issues.push({
      code: "audio-generation-not-supported",
      path: `${path}.assetId`,
      value: assetId,
    });
    return null;
  }
  if (kind !== canonicalKind) {
    issues.push({ code: "asset-plan-kind-mismatch", path: `${path}.kind`, value: kind });
    return null;
  }

  return {
    assetId,
    kind: canonicalKind,
    prompt,
    aspectRatio: aspectRatio as FateKnotsForgeAspectRatio,
    ...(batchGroup !== undefined ? { batchGroup } : {}),
  };
}

/**
 * Validates an AI-authored Forge response as a non-canonical draft.
 * Every visual asset must still point to a pending sentinel and have exactly
 * one generation plan. The draft is never safe to persist as canonical runtime
 * state until finalization replaces those sentinels with real stored files.
 */
export function validateFateKnotsWorldForgeDraftResponse(
  request: FateKnotsWorldForgeRequest,
  response: unknown
): FateKnotsWorldForgeDraftResult {
  const issues: FateKnotsWorldForgeIssue[] = [];
  if (!isRecord(response)) {
    return { ok: false, draft: null, issues: [{ code: "invalid-response-root", path: "$" }] };
  }

  if (response["schemaVersion"] !== FATE_KNOTS_WORLD_FORGE_SCHEMA_VERSION) {
    issues.push({
      code: "unsupported-forge-schema-version",
      path: "schemaVersion",
      value: String(response["schemaVersion"]),
    });
  }
  if (response["requestId"] !== request.requestId) {
    issues.push({
      code: "request-id-mismatch",
      path: "requestId",
      value: String(response["requestId"]),
    });
  }
  if (response["kind"] !== "universe-draft") {
    issues.push({
      code: "response-kind-mismatch",
      path: "kind",
      value: String(response["kind"]),
    });
  }

  // An empty object conveys no presentation cues, just like an empty array.
  // Normalize only that unambiguous authoring mistake at the draft boundary.
  // Non-empty objects and all other invalid fields remain validation errors.
  const rawUniverse = response["universe"];
  const normalizedUniverse =
    isRecord(rawUniverse) && Array.isArray(rawUniverse["cards"])
      ? {
          ...rawUniverse,
          cards: rawUniverse["cards"].map((card) =>
            isRecord(card) &&
            isRecord(card["presentation"]) &&
            Object.keys(card["presentation"]).length === 0
              ? { ...card, presentation: [] }
              : card
          ),
        }
      : rawUniverse;
  const universeValidation = parseFateKnotsUniversePackage(normalizedUniverse);
  if (!universeValidation.valid || universeValidation.package === null) {
    issues.push({
      code: "invalid-universe-package",
      path: "universe",
      validationIssues: universeValidation.issues,
    });
    return { ok: false, draft: null, issues };
  }

  const canonical = normalizeFateKnotsCanonicalUniversePackage(universeValidation.package);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      draft: null,
      issues: [
        { code: "invalid-universe-package", path: "universe", validationIssues: canonical.issues },
      ],
    };
  }
  const universe = canonical.package;
  if (universe.schemaVersion !== FATE_KNOTS_SCHEMA_VERSION) {
    issues.push({ code: "invalid-universe-package", path: "universe.schemaVersion" });
  }
  if (universe.universeId !== request.universeId) {
    issues.push({
      code: "universe-id-mismatch",
      path: "universe.universeId",
      value: universe.universeId,
    });
  }
  if (universe.createdAt !== request.createdAt) {
    issues.push({
      code: "created-at-mismatch",
      path: "universe.createdAt",
      value: universe.createdAt,
    });
  }

  const assetKindById = new Map(universe.assets.map((asset) => [asset.id, asset.kind] as const));
  const rawPlans = response["assetPlans"];
  if (!Array.isArray(rawPlans)) {
    issues.push({ code: "invalid-asset-plan", path: "assetPlans" });
    return { ok: false, draft: null, issues };
  }

  const plans: FateKnotsWorldForgeAssetPlan[] = [];
  const planIds = new Set<string>();
  rawPlans.forEach((value, index) => {
    const plan = parseAssetPlan(value, index, assetKindById, issues);
    if (plan === null) return;
    if (planIds.has(plan.assetId)) {
      issues.push({
        code: "duplicate-asset-plan",
        path: `assetPlans[${index}].assetId`,
        value: plan.assetId,
      });
      return;
    }
    planIds.add(plan.assetId);
    plans.push(plan);
  });

  universe.assets.forEach((asset, index) => {
    if (asset.kind === "audio") {
      issues.push({
        code: "audio-generation-not-supported",
        path: `universe.assets[${index}]`,
        value: asset.id,
      });
      return;
    }
    const expectedPath = buildFateKnotsPendingAssetPath(asset.id);
    if (asset.path !== expectedPath) {
      issues.push({
        code: "asset-path-not-pending",
        path: `universe.assets[${index}].path`,
        value: asset.path,
      });
    }
    if (!planIds.has(asset.id)) {
      issues.push({
        code: "asset-plan-reference-missing",
        path: `universe.assets[${index}].id`,
        value: asset.id,
      });
    }
  });

  if (issues.length > 0) return { ok: false, draft: null, issues };

  return {
    ok: true,
    draft: {
      schemaVersion: FATE_KNOTS_WORLD_FORGE_SCHEMA_VERSION,
      requestId: request.requestId,
      universe: cloneUniverse(universe),
      assetPlans: plans.map((plan) => ({ ...plan })),
    },
    issues: [],
  };
}

/**
 * Converts a validated draft into a canonical Universe Package only after every
 * planned asset has been materialized into a real local path. Story/rule content
 * is not regenerated or repaired here: finalization only replaces asset paths,
 * applies optional materialized mime types, then re-runs canonical validation and
 * lossless normalization.
 */
export function finalizeFateKnotsWorldForgeDraft(
  draft: FateKnotsWorldForgeDraft,
  materializedAssets: readonly FateKnotsMaterializedAsset[]
): FateKnotsWorldForgeFinalizationResult {
  const issues: FateKnotsWorldForgeIssue[] = [];
  const byId = new Map<string, FateKnotsMaterializedAsset>();

  materializedAssets.forEach((asset, index) => {
    const assetId = asset.assetId.trim();
    const path = asset.path.trim();
    if (assetId === "" || path === "" || isFateKnotsPendingAssetPath(path)) {
      issues.push({
        code: "materialized-path-invalid",
        path: `materializedAssets[${index}]`,
        value: path,
      });
      return;
    }
    if (byId.has(assetId)) {
      issues.push({
        code: "duplicate-materialized-asset",
        path: `materializedAssets[${index}].assetId`,
        value: assetId,
      });
      return;
    }
    byId.set(assetId, {
      assetId,
      path,
      ...(asset.mimeType !== undefined ? { mimeType: asset.mimeType } : {}),
    });
  });

  const draftAssetIds = new Set(draft.universe.assets.map((asset) => asset.id));
  draft.universe.assets.forEach((asset, index) => {
    if (!byId.has(asset.id)) {
      issues.push({
        code: "materialized-asset-missing",
        path: `universe.assets[${index}].id`,
        value: asset.id,
      });
    }
  });
  for (const assetId of byId.keys()) {
    if (!draftAssetIds.has(assetId)) {
      issues.push({
        code: "asset-plan-reference-missing",
        path: "materializedAssets",
        value: assetId,
      });
    }
  }
  if (issues.length > 0) return { ok: false, universe: null, issues };

  const hydrated = cloneUniverse(draft.universe);
  hydrated.assets = hydrated.assets.map((asset) => {
    const materialized = byId.get(asset.id);
    if (materialized === undefined) return asset;
    return {
      ...asset,
      path: materialized.path,
      ...(materialized.mimeType !== undefined ? { mimeType: materialized.mimeType } : {}),
    };
  });

  const boundary = parseFateKnotsUniversePackage(hydrated);
  const normalized = boundary.valid
    ? normalizeFateKnotsCanonicalUniversePackage(boundary.package)
    : boundary;
  if (!normalized.valid || normalized.package === null) {
    return {
      ok: false,
      universe: null,
      issues: [
        {
          code: "final-universe-invalid",
          path: "universe",
          validationIssues: normalized.issues,
        },
      ],
    };
  }

  if (normalized.package.assets.some((asset) => isFateKnotsPendingAssetPath(asset.path))) {
    return {
      ok: false,
      universe: null,
      issues: [{ code: "materialized-path-invalid", path: "universe.assets" }],
    };
  }

  return {
    ok: true,
    universe: normalized.package,
    issues: [],
  };
}
