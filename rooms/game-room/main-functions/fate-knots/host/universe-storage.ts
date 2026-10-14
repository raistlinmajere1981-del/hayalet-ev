import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import type { FateKnotsUniverseValidationIssue } from "../forge/universe-validation.js";
import type { FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  saveFateKnotsUniverse,
  type FateKnotsPersistenceApi,
  type FateKnotsPersistenceIssue,
} from "./persistence.js";

export type FateKnotsUniverseAcceptanceResult =
  | { ok: true; universe: FateKnotsUniversePackage; issues: [] }
  | {
      ok: false;
      universe: null;
      error: "validation-rejected";
      validationIssues: FateKnotsUniverseValidationIssue[];
      persistenceIssues: [];
    }
  | {
      ok: false;
      universe: null;
      error: "persistence-rejected";
      validationIssues: [];
      persistenceIssues: FateKnotsPersistenceIssue[];
    };

/**
 * The only World Forge -> canonical storage boundary for V1.
 *
 * A provider candidate is first validated as a complete runnable universe,
 * including deterministic run-start data, and only then passed to persistence.
 * Renderer code should never call the lower-level universe persistence helper
 * with an arbitrary object.
 */
export function acceptFateKnotsUniverseCandidate(
  api: FateKnotsPersistenceApi,
  candidate: unknown
): FateKnotsUniverseAcceptanceResult {
  const canonical = normalizeFateKnotsCanonicalUniversePackage(candidate);
  if (!canonical.valid || !canonical.package) {
    return {
      ok: false,
      universe: null,
      error: "validation-rejected",
      validationIssues: canonical.issues,
      persistenceIssues: [],
    };
  }

  const saved = saveFateKnotsUniverse(api, canonical.package);
  if (!saved.ok) {
    return {
      ok: false,
      universe: null,
      error: "persistence-rejected",
      validationIssues: [],
      persistenceIssues: saved.issues,
    };
  }

  return { ok: true, universe: saved.value, issues: [] };
}
