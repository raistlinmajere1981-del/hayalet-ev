import { isAiProviderAccount } from "@shared/settings.js";
import type { Account } from "@shared/settings.js";
import { AppState } from "../../../modules/app-state.js";
import { getSceneCharacterRoleConfig } from "../../../scene/scene-config.js";

import type { SceneCharacterKind, SceneCharacterRole } from "./scene-character-role.js";
import {
  DEFAULT_ENTRANCE_SCENE_MAP,
  type EntranceSceneCharacterAnchorConfig,
} from "./scene-map.js";
import {
  getSceneCharacterState,
  type SceneCharacterSlot,
  type SceneCharacterState,
} from "./scene-character-state.js";

type SceneCharacterAnchor = EntranceSceneCharacterAnchorConfig;

export interface SceneCharacterDescriptor {
  id: string;
  kind: SceneCharacterKind;
  role: SceneCharacterRole;
  accountId: string | null;
  remoteUserId: string | null;
  providerId: string | null;
  slot: SceneCharacterSlot | null;
  anchorId: string;
  label: string;
  headLabel: string | null;
  leftPx: number;
  bottomPx: number;
  scale: number;
  depth: number;
  state: SceneCharacterState;
  variant: "account" | "assistant" | "remote" | "user";
  bodySrc: string;
  bodyScale: number;
  headTopPct: number;
  headLeftPct: number;
  headSizePct: number;
  avatarScale: number;
  avatarSource: string | null;
}

function toHeadLabel(label: string): string {
  const compact = label.replace(/\s+/g, "").trim().toUpperCase();
  const head = compact.slice(0, 2);
  return head === "" ? "?" : head;
}

function compareAccounts(left: Account, right: Account): number {
  const leftLabel = (
    getFirstNonEmpty(left.nickname, left.email, left.id) ?? left.id
  ).toLocaleLowerCase("tr-TR");
  const rightLabel = (
    getFirstNonEmpty(right.nickname, right.email, right.id) ?? right.id
  ).toLocaleLowerCase("tr-TR");

  if (leftLabel !== rightLabel) {
    return leftLabel.localeCompare(rightLabel, "tr");
  }

  return left.id.localeCompare(right.id, "tr");
}

function getVisibleAiAccounts(): Account[] {
  const settings = AppState.getSettings();
  if (settings === null) {
    return [];
  }

  const allAccounts = settings.accounts.filter((account) => isAiProviderAccount(account));
  const assignedAccountIds = new Set([
    settings.slots.ai1.accountId ?? "",
    settings.slots.ai2.accountId ?? "",
  ]);

  const ai1Account =
    allAccounts.find((account) => account.id === settings.slots.ai1.accountId) ?? null;
  const ai2Account =
    allAccounts.find((account) => account.id === settings.slots.ai2.accountId) ?? null;

  const remaining = allAccounts
    .filter((account) => !assignedAccountIds.has(account.id))
    .sort(compareAccounts);

  return [ai1Account, ...remaining, ai2Account].filter(
    (account): account is Account => account !== null
  );
}

function getSlotForAccount(accountId: string): SceneCharacterSlot | null {
  const ai1Account = AppState.getAccountForSlot("ai1");
  if (ai1Account?.id === accountId) {
    return "ai1";
  }

  const ai2Account = AppState.getAccountForSlot("ai2");
  if (ai2Account?.id === accountId) {
    return "ai2";
  }

  return null;
}

function getFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = value?.trim() ?? "";
    if (normalized !== "") {
      return normalized;
    }
  }

  return null;
}

function getAiAnchorQueue(anchors: readonly SceneCharacterAnchor[]): SceneCharacterAnchor[] {
  const aiAnchors = anchors.filter((anchor) => anchor.kind === "ai");
  const ordered: SceneCharacterAnchor[] = [];

  const ai1Anchor = aiAnchors.find((anchor) => anchor.preferredSlot === "ai1");
  const leftOuterAnchor = aiAnchors.find((anchor) => anchor.id === "anchor-ai-left-outer");
  const ai2Anchor = aiAnchors.find((anchor) => anchor.preferredSlot === "ai2");
  const rightOuterAnchor = aiAnchors.find((anchor) => anchor.id === "anchor-ai-right-outer");

  [leftOuterAnchor, ai1Anchor, ai2Anchor, rightOuterAnchor].forEach((anchor) => {
    if (anchor !== undefined) {
      ordered.push(anchor);
    }
  });

  return ordered;
}

function createDescriptorBase(
  role: SceneCharacterRole,
  anchor: SceneCharacterAnchor,
  state: SceneCharacterState
): Pick<
  SceneCharacterDescriptor,
  | "role"
  | "anchorId"
  | "leftPx"
  | "bottomPx"
  | "scale"
  | "depth"
  | "state"
  | "bodySrc"
  | "bodyScale"
  | "headTopPct"
  | "headLeftPct"
  | "headSizePct"
  | "avatarScale"
> {
  const roleConfig = getSceneCharacterRoleConfig(role);

  return {
    role,
    anchorId: anchor.id,
    leftPx: anchor.leftPx,
    bottomPx: anchor.bottomPx,
    scale: anchor.scale,
    depth: anchor.depth,
    state,
    bodySrc: roleConfig.bodySrc,
    bodyScale: roleConfig.bodyScale,
    headTopPct: roleConfig.headTopPct,
    headLeftPct: roleConfig.headLeftPct,
    headSizePct: roleConfig.headSizePct,
    avatarScale: roleConfig.avatarScale,
  };
}

function createAiCharacterDescriptor(
  account: Account,
  anchor: SceneCharacterAnchor,
  index: number
): SceneCharacterDescriptor {
  const slot = getSlotForAccount(account.id);
  const fallbackLabel = `AI ${index + 1}`;
  const label = getFirstNonEmpty(account.nickname, account.email, fallbackLabel) ?? fallbackLabel;

  return {
    id: `scene-account-${account.id}`,
    kind: "ai",
    accountId: account.id,
    remoteUserId: null,
    providerId: account.provider,
    slot,
    label,
    headLabel: toHeadLabel(label),
    variant: "account",
    avatarSource: getFirstNonEmpty(
      account.avatarPath,
      account.avatar,
      `src/assets/${account.provider}.png`,
      "src/assets/default.png"
    ),
    ...createDescriptorBase("ai", anchor, getSceneCharacterState(slot)),
  };
}

function createAssistantCharacterDescriptor(
  anchor: SceneCharacterAnchor
): SceneCharacterDescriptor {
  const settings = AppState.getSettings();
  const assistantAccount = AppState.getAccountForSlot("ai0");
  const assistantAccountId = settings?.assistantSlot?.accountId ?? assistantAccount?.id ?? null;
  const label = AppState.getNickname("ai0");

  return {
    id: "scene-assistant-ai0",
    kind: "assistant",
    accountId: assistantAccountId,
    remoteUserId: null,
    providerId: assistantAccount?.provider ?? null,
    slot: "ai0",
    label,
    headLabel: toHeadLabel(label),
    variant: "assistant",
    avatarSource: getFirstNonEmpty(
      assistantAccount?.avatarPath,
      assistantAccount?.avatar,
      AppState.getAvatar("ai0"),
      "src/assets/default.png"
    ),
    ...createDescriptorBase("assistant", anchor, getSceneCharacterState("ai0")),
  };
}

function createUserCharacterDescriptor(anchor: SceneCharacterAnchor): SceneCharacterDescriptor {
  const settings = AppState.getSettings();
  const label = AppState.getNickname("user");

  return {
    id: "scene-user",
    kind: "user",
    accountId: null,
    remoteUserId: null,
    providerId: "user",
    slot: null,
    label,
    headLabel: toHeadLabel(label),
    variant: "user",
    avatarSource: getFirstNonEmpty(
      settings?.user?.avatarPath,
      "src/assets/user.png",
      "src/assets/default.png"
    ),
    ...createDescriptorBase("user", anchor, "connected"),
  };
}

function createUs1CharacterDescriptor(
  anchor: SceneCharacterAnchor
): SceneCharacterDescriptor | null {
  const us1Identity = AppState.getUs1Identity();
  const us1AccountId = AppState.getUs1ArchiveAccountId();
  if (us1Identity === null) {
    return null;
  }

  const label = getFirstNonEmpty(us1Identity.nickname, us1Identity.email, "US1") ?? "US1";

  return {
    id: `scene-remote-${us1Identity.remoteUserId}`,
    kind: "us1",
    accountId: us1AccountId,
    remoteUserId: us1Identity.remoteUserId,
    providerId: "remote-email",
    slot: "us1",
    label,
    headLabel: toHeadLabel(label),
    variant: "remote",
    avatarSource: getFirstNonEmpty(
      us1Identity.avatarPath,
      us1Identity.avatar,
      "src/assets/default.png"
    ),
    ...createDescriptorBase("human", anchor, getSceneCharacterState("us1")),
  };
}

export function buildSceneCharacterRoster(
  anchors: readonly SceneCharacterAnchor[] = DEFAULT_ENTRANCE_SCENE_MAP.characterAnchors
): SceneCharacterDescriptor[] {
  const roster: SceneCharacterDescriptor[] = [];

  const userAnchor = anchors.find((anchor) => anchor.kind === "user");
  if (userAnchor !== undefined) {
    roster.push(createUserCharacterDescriptor(userAnchor));
  }

  const aiAnchorQueue = getAiAnchorQueue(anchors);
  const aiAccounts = getVisibleAiAccounts().slice(0, aiAnchorQueue.length);
  aiAccounts.forEach((account, index) => {
    const anchor = aiAnchorQueue[index];
    if (anchor === undefined) {
      return;
    }

    roster.push(createAiCharacterDescriptor(account, anchor, index));
  });

  const assistantAnchor = anchors.find((anchor) => anchor.kind === "assistant");
  if (assistantAnchor !== undefined) {
    roster.push(createAssistantCharacterDescriptor(assistantAnchor));
  }

  const us1Anchor = anchors.find((anchor) => anchor.kind === "us1");
  if (us1Anchor !== undefined) {
    const us1Descriptor = createUs1CharacterDescriptor(us1Anchor);
    if (us1Descriptor !== null) {
      roster.push(us1Descriptor);
    }
  }

  return roster.sort((left, right) => left.depth - right.depth);
}
