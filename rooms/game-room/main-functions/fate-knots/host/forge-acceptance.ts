import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import {
  saveFateKnotsUniverse,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export interface FateKnotsForgeAcceptanceIssue {
  source: "canonical-validation" | "persistence";
  code: string;
  path?: string;
  value?: string;
}

export type FateKnotsForgeAcceptanceResult =
  | {
      ok: true;
      universeId: string;
      title: string;
      issues: [];
    }
  | {
      ok: false;
      error: "candidate-rejected" | "persistence-rejected";
      universeId: null;
      title: null;
      issues: FateKnotsForgeAcceptanceIssue[];
    };

function mapPersistenceIssue(issue: FateKnotsPersistenceIssue): FateKnotsForgeAcceptanceIssue {
  return {
    source: "persistence",
    code: issue.code,
    ...(issue.entryId ? { value: issue.entryId } : {}),
    ...(issue.detail ? { path: issue.detail } : {}),
  };
}

/**
 * Host-only World Forge acceptance gate.
 *
 * Provider output is always an untrusted candidate. It must pass the full
 * structural validator plus the runnable V1 start contract before persistence.
 * This function is intentionally not a room-ui command: renderer/browser code
 * never gains authority to submit a raw Universe Package as accepted canon.
 */
export function acceptFateKnotsForgeCandidate(
  api: FateKnotsPersistenceApi,
  candidate: unknown
): FateKnotsForgeAcceptanceResult {
  const canonical = normalizeFateKnotsCanonicalUniversePackage(candidate);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      error: "candidate-rejected",
      universeId: null,
      title: null,
      issues: canonical.issues.map((issue) => ({
        source: "canonical-validation" as const,
        code: issue.code,
        path: issue.path,
        ...(issue.value !== undefined ? { value: String(issue.value) } : {}),
      })),
    };
  }

  const saved = saveFateKnotsUniverse(api, canonical.package);
  if (!saved.ok) {
    return {
      ok: false,
      error: "persistence-rejected",
      universeId: null,
      title: null,
      issues: saved.issues.map(mapPersistenceIssue),
    };
  }

  return {
    ok: true,
    universeId: saved.value.universeId,
    title: saved.value.title,
    issues: [],
  };
}
