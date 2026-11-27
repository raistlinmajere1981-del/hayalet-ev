import type { InstallationApproval } from "./installation.ts";
import type { FieldEndpoint } from "./receiver.ts";

export interface ProjectSession {
  project: string;
  session: string;
}
export interface FieldAssignment {
  id: string;
  deviceId: string;
  hardwareId: string;
  fingerprint: string;
  installationId: string;
  authorizationGeneration: number;
  capabilities: string[];
  state: "active" | "pending" | "revoked";
}
export interface FieldState {
  enabled: boolean;
  endpoint?: FieldEndpoint;
  listening: boolean;
  ca: "absent" | "ready" | "unavailable";
  caFingerprint?: string;
  serverFingerprint?: string;
  assignments: FieldAssignment[];
  assignmentError?: "unavailable";
}
export type FieldOperation =
  | { action: "state"; origin?: string }
  | { action: "provision"; origin: string }
  | { action: "rotateServer"; origin: string }
  | { action: "start"; endpoint: FieldEndpoint }
  | { action: "stop" }
  | {
      action: "inspect";
      deviceId: string;
      hardwareId: string;
      capabilities: string[];
      revision: number;
      origin: string;
      change: InstallationApproval["change"];
    }
  | { action: "issue"; reviewId: string }
  | { action: "enroll"; deviceId: string }
  | { action: "complete" | "revoke"; deviceId: string; assignmentId: string };

export interface FieldResults {
  state: FieldState;
  provision: { caFingerprint: string; serverFingerprint: string };
  rotateServer: { serverFingerprint: string };
  start: { listening: boolean };
  stop: { listening: boolean };
  inspect: { reviewId: string; approval: InstallationApproval };
  issue: { filename: string; fingerprint: string };
  enroll: FieldAssignment;
  complete: FieldAssignment;
  revoke: FieldAssignment;
}
export type FieldError = "cancelled" | "busy" | "invalid_request" | "scope_changed" | "unavailable";
export type FieldReply<K extends FieldOperation["action"]> =
  { ok: true; data: FieldResults[K] } | { ok: false; code: FieldError };
