export type SceneCharacterRole = "ai" | "assistant" | "human" | "user";
export type SceneCharacterKind = "ai" | "assistant" | "us1" | "user";

export interface SceneCharacterRoleConfig {
  bodySrc: string;
  bodyScale: number;
  headTopPct: number;
  headLeftPct: number;
  headSizePct: number;
  avatarScale: number;
}
