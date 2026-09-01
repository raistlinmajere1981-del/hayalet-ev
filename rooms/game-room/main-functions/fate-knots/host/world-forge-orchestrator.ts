import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import {
  materializeFateKnotsWorldForgeAssets,
  type FateKnotsAssetMaterializerAdapter,
  type FateKnotsAssetMaterializationResult,
} from "../forge/materializer.js";
import { validateFateKnotsPlayableUniverse } from "../forge/playability-validation.js";
import {
  buildFateKnotsWorldForgeRequest,
  finalizeFateKnotsWorldForgeDraft,
  type FateKnotsWorldForgeRequest,
} from "../forge/world-forge.js";
import { validateFateKnotsCardArtBindings } from "../shared/card-art.js";
import type { FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  hydrateFateKnotsDurablePersistence,
  saveFateKnotsUniverseDurable,
} from "./durable-persistence.js";
import {
  resolveFateKnotsDurableStoragePaths,
  verifyFateKnotsManagedAssetFiles,
  writeFateKnotsJsonFile,
} from "./storage-bridge.js";
import type { FateKnotsTransportApi } from "./transport.js";
import { authorFateKnotsWorldForgeDraft } from "./world-forge-authoring.js";

export type FateKnotsWorldForgeProgressStage =
  | "preparing"
  | "authoring"
  | "materializing"
  | "finalizing"
  | "saving"
  | "completed"
  | "failed";

export interface FateKnotsWorldForgeProgress {
  requestId: string;
  universeId: string;
  stage: FateKnotsWorldForgeProgressStage;
  completedAssets: number;
  totalAssets: number;
  message: string;
}

export type FateKnotsWorldForgePipelineResult =
  | {
      ok: true;
      request: FateKnotsWorldForgeRequest;
      universe: FateKnotsUniversePackage;
      materialization: FateKnotsAssetMaterializationResult;
      provenanceWarning?: string;
    }
  | {
      ok: false;
      request: FateKnotsWorldForgeRequest;
      code:
        | "storage-unavailable"
        | "authoring-failed"
        | "materialization-incomplete"
        | "materialization-invalid"
        | "finalization-failed"
        | "playability-failed"
        | "card-art-failed"
        | "save-failed"
        | "unexpected-failure";
      message: string;
      materialization?: FateKnotsAssetMaterializationResult;
    };

function createUniqueSuffix(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function createFateKnotsWorldForgeRequest(
  brief: string | null = null,
  createdAt = new Date().toISOString()
): FateKnotsWorldForgeRequest {
  const suffix = createUniqueSuffix();
  return buildFateKnotsWorldForgeRequest(
    `forge-${suffix}`,
    `universe-${suffix}`,
    createdAt,
    brief
  );
}

async function writeCheckpoint(value: unknown): Promise<void> {
  const paths = await resolveFateKnotsDurableStoragePaths();
  await writeFateKnotsJsonFile(paths.forgeDraftPath, value);
}

function progress(
  request: FateKnotsWorldForgeRequest,
  stage: FateKnotsWorldForgeProgressStage,
  completedAssets: number,
  totalAssets: number,
  message: string
): FateKnotsWorldForgeProgress {
  return {
    requestId: request.requestId,
    universeId: request.universeId,
    stage,
    completedAssets,
    totalAssets,
    message,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Complete provider-neutral World Forge transaction. Every pre-save exception
 * becomes a terminal failed progress state. Once the canonical durable save has
 * succeeded, provenance/checkpoint failure is only a retryable warning: a
 * committed Universe Package is never reported as if it did not exist.
 */
export async function runFateKnotsWorldForge(
  api: GameRoomHostApi & FateKnotsTransportApi,
  adapter: FateKnotsAssetMaterializerAdapter,
  options: {
    brief?: string | null;
    request?: FateKnotsWorldForgeRequest;
    onProgress?: (event: FateKnotsWorldForgeProgress) => void;
  } = {}
): Promise<FateKnotsWorldForgePipelineResult> {
  const request = options.request ?? createFateKnotsWorldForgeRequest(options.brief ?? null);
  const emit = options.onProgress ?? (() => undefined);
  let completedAssets = 0;
  let totalAssets = 0;

  try {
    emit(progress(request, "preparing", 0, 0, "Preparing World Forge."));
    const hydrated = await hydrateFateKnotsDurablePersistence(api);
    if (!hydrated.ok) {
      emit(progress(request, "failed", 0, 0, "Durable storage is unavailable."));
      return {
        ok: false,
        request,
        code: "storage-unavailable",
        message: hydrated.storageError ?? "Fate Knots durable storage is unavailable.",
      };
    }

    emit(progress(request, "authoring", 0, 0, "Authoring canonical world candidate."));
    const authored = await authorFateKnotsWorldForgeDraft(api, request);
    if (!authored.ok) {
      emit(progress(request, "failed", 0, 0, authored.message));
      try {
        await writeCheckpoint({
          schemaVersion: 1,
          request,
          status: "authoring-failed",
          message: authored.message,
          issues: authored.issues ?? [],
        });
      } catch {
        // Primary failure remains the authoring failure.
      }
      return { ok: false, request, code: "authoring-failed", message: authored.message };
    }

    const draft = authored.draft;
    totalAssets = draft.assetPlans.length;
    await writeCheckpoint({ schemaVersion: 1, request, status: "draft-validated", draft });

    emit(
      progress(
        request,
        "materializing",
        0,
        totalAssets,
        "Generating and storing universe assets."
      )
    );
    const materialization = await materializeFateKnotsWorldForgeAssets(draft, adapter);
    completedAssets = materialization.assets.length;
    emit(
      progress(
        request,
        materialization.complete ? "finalizing" : "failed",
        completedAssets,
        totalAssets,
        materialization.complete
          ? "All universe assets are materialized."
          : "One or more universe assets could not be materialized."
      )
    );

    await writeCheckpoint({
      schemaVersion: 1,
      request,
      status: materialization.complete ? "assets-materialized" : "materialization-incomplete",
      draft,
      materialization,
    });

    if (!materialization.complete) {
      return {
        ok: false,
        request,
        code: "materialization-incomplete",
        message: `${materialization.failures.length} materialization job(s) require retry.`,
        materialization,
      };
    }

    const verifiedFiles = await verifyFateKnotsManagedAssetFiles(materialization.assets);
    if (!verifiedFiles.valid) {
      emit(
        progress(
          request,
          "failed",
          completedAssets,
          totalAssets,
          "Materialized assets failed managed-storage verification."
        )
      );
      await writeCheckpoint({
        schemaVersion: 1,
        request,
        status: "materialization-invalid",
        failures: verifiedFiles.failures,
        materialization,
      });
      return {
        ok: false,
        request,
        code: "materialization-invalid",
        message: `${verifiedFiles.failures.length} materialized asset file(s) failed verification.`,
        materialization,
      };
    }

    const finalized = finalizeFateKnotsWorldForgeDraft(draft, materialization.assets);
    if (!finalized.ok || !finalized.universe) {
      emit(
        progress(
          request,
          "failed",
          completedAssets,
          totalAssets,
          "Final universe validation failed."
        )
      );
      return {
        ok: false,
        request,
        code: "finalization-failed",
        message: `Final universe failed ${finalized.issues.length} validation check(s).`,
        materialization,
      };
    }

    const playable = validateFateKnotsPlayableUniverse(finalized.universe);
    if (!playable.valid) {
      emit(
        progress(
          request,
          "failed",
          completedAssets,
          totalAssets,
          "Final universe is not playable."
        )
      );
      return {
        ok: false,
        request,
        code: "playability-failed",
        message: `Final universe failed ${playable.issues.length} playability check(s).`,
        materialization,
      };
    }

    const cardArtIssues = validateFateKnotsCardArtBindings(finalized.universe);
    if (cardArtIssues.length > 0) {
      emit(
        progress(
          request,
          "failed",
          completedAssets,
          totalAssets,
          "Final card art bindings are invalid."
        )
      );
      return {
        ok: false,
        request,
        code: "card-art-failed",
        message: `Final universe failed ${cardArtIssues.length} card-art binding check(s).`,
        materialization,
      };
    }

    emit(
      progress(
        request,
        "saving",
        completedAssets,
        totalAssets,
        "Saving canonical universe."
      )
    );
    const saved = await saveFateKnotsUniverseDurable(api, finalized.universe);
    if (!saved.ok || !saved.value) {
      emit(
        progress(
          request,
          "failed",
          completedAssets,
          totalAssets,
          "Canonical universe save failed."
        )
      );
      return {
        ok: false,
        request,
        code: "save-failed",
        message: saved.storageError ?? "Canonical Fate Knots universe could not be saved.",
        materialization,
      };
    }

    let provenanceWarning: string | undefined;
    try {
      await writeCheckpoint({
        schemaVersion: 1,
        request,
        status: "completed",
        universeId: saved.value.universeId,
        sourceArtifacts: materialization.sourceArtifacts,
        materializedAssets: materialization.assets,
      });
    } catch (error) {
      provenanceWarning = `Universe saved, but Forge provenance checkpoint needs retry: ${errorMessage(error)}`;
    }

    emit(
      progress(
        request,
        "completed",
        completedAssets,
        totalAssets,
        provenanceWarning ?? "Universe ready."
      )
    );
    return {
      ok: true,
      request,
      universe: saved.value,
      materialization,
      ...(provenanceWarning ? { provenanceWarning } : {}),
    };
  } catch (error) {
    const message = `World Forge stopped safely: ${errorMessage(error)}`;
    emit(progress(request, "failed", completedAssets, totalAssets, message));
    try {
      await writeCheckpoint({ schemaVersion: 1, request, status: "unexpected-failure", message });
    } catch {
      // Terminal progress remains authoritative even if the debug checkpoint cannot be written.
    }
    return { ok: false, request, code: "unexpected-failure", message };
  }
}
