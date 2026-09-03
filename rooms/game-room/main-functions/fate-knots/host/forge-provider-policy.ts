export const FATE_KNOTS_FORGE_AUTHORING_PROVIDERS = ["ai1", "ai2"] as const;
export const FATE_KNOTS_FORGE_ASSET_PROVIDERS = ["ai1", "ai0-local"] as const;

export type FateKnotsForgeAuthoringProvider =
  (typeof FATE_KNOTS_FORGE_AUTHORING_PROVIDERS)[number];
export type FateKnotsForgeAssetProvider = (typeof FATE_KNOTS_FORGE_ASSET_PROVIDERS)[number];

export interface FateKnotsForgeExecutionPolicy {
  authoringProvider: FateKnotsForgeAuthoringProvider;
  assetProvider: FateKnotsForgeAssetProvider;
}

export const FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY: Readonly<FateKnotsForgeExecutionPolicy> =
  Object.freeze({
    authoringProvider: "ai1",
    assetProvider: "ai1",
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFateKnotsForgeAuthoringProvider(
  value: unknown
): value is FateKnotsForgeAuthoringProvider {
  return value === "ai1" || value === "ai2";
}

export function isFateKnotsForgeAssetProvider(value: unknown): value is FateKnotsForgeAssetProvider {
  return value === "ai1" || value === "ai0-local";
}

export type FateKnotsForgeExecutionPolicyReadResult =
  | { ok: true; policy: FateKnotsForgeExecutionPolicy }
  | {
      ok: false;
      code: "invalid-authoring-provider" | "invalid-asset-provider" | "invalid-policy";
      message: string;
    };

/**
 * Reads an untrusted Forge execution policy without leaking provider choice into
 * the canonical Universe Package. Missing fields preserve the historical AI1
 * defaults; explicitly invalid values are rejected rather than silently masked.
 */
export function readFateKnotsForgeExecutionPolicy(
  value: unknown
): FateKnotsForgeExecutionPolicyReadResult {
  if (value === undefined || value === null) {
    return { ok: true, policy: { ...FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY } };
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      code: "invalid-policy",
      message: "Fate Knots Forge provider policy must be an object.",
    };
  }

  const authoringProvider =
    value["authoringProvider"] ?? FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY.authoringProvider;
  if (!isFateKnotsForgeAuthoringProvider(authoringProvider)) {
    return {
      ok: false,
      code: "invalid-authoring-provider",
      message: "Fate Knots Forge authoring provider must be ai1 or ai2.",
    };
  }

  const assetProvider =
    value["assetProvider"] ?? FATE_KNOTS_DEFAULT_FORGE_EXECUTION_POLICY.assetProvider;
  if (!isFateKnotsForgeAssetProvider(assetProvider)) {
    return {
      ok: false,
      code: "invalid-asset-provider",
      message: "Fate Knots Forge asset provider must be ai1 or ai0-local.",
    };
  }

  return { ok: true, policy: { authoringProvider, assetProvider } };
}
