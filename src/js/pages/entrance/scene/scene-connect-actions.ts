import type { AppSettings } from "@shared/settings.js";

export type SceneAiTargetSlot = "ai1" | "ai2";

export interface SceneAiConnectResolution {
  slot: SceneAiTargetSlot | null;
  mode: "assigned" | "available" | "unavailable";
}

export interface SceneUs1ConnectResolution {
  slot: "us1";
  selectedAccountId: string | null;
  selectedRemoteUserId: string | null;
}

function normalizeAccountId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSceneAiConnectSlot(
  accountId: string | null | undefined,
  settings: AppSettings
): SceneAiConnectResolution {
  const normalizedAccountId = normalizeAccountId(accountId);
  if (normalizedAccountId === "") {
    return {
      slot: null,
      mode: "unavailable",
    };
  }

  const ai1AccountId = normalizeAccountId(settings.slots.ai1.accountId);
  if (ai1AccountId === normalizedAccountId) {
    return {
      slot: "ai1",
      mode: "assigned",
    };
  }

  const ai2AccountId = normalizeAccountId(settings.slots.ai2.accountId);
  if (ai2AccountId === normalizedAccountId) {
    return {
      slot: "ai2",
      mode: "assigned",
    };
  }

  if (ai1AccountId === "") {
    return {
      slot: "ai1",
      mode: "available",
    };
  }

  if (ai2AccountId === "") {
    return {
      slot: "ai2",
      mode: "available",
    };
  }

  return {
    slot: null,
    mode: "unavailable",
  };
}

export function resolveSceneUs1ConnectTarget(settings: AppSettings): SceneUs1ConnectResolution {
  const selectedAccountId = normalizeAccountId(settings.us1Slot?.selectedAccountId);
  const selectedRemoteUserId = normalizeAccountId(settings.us1Slot?.selectedRemoteUserId);

  return {
    slot: "us1",
    selectedAccountId: selectedAccountId !== "" ? selectedAccountId : null,
    selectedRemoteUserId: selectedRemoteUserId !== "" ? selectedRemoteUserId : null,
  };
}
