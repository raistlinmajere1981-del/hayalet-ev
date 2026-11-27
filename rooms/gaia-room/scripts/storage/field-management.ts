import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  inspectUsbRequest,
  parseApproval,
  verifyInstallation,
  type InstallationApproval,
} from "../field/installation.ts";
import { httpsHost } from "../field/certificates.ts";
import type { FieldReceiverControl } from "../field/lifecycle.ts";
import { validateEndpoint, type FieldEndpoint } from "../field/receiver.ts";
import {
  verifyAssignmentBinding,
  FieldAuthorizationDenied,
  type AuthorizationAssignment,
} from "../field/enrollment.ts";
import type {
  FieldAssignment,
  FieldError,
  FieldOperation,
  FieldReply,
  FieldState,
  FieldResults,
  ProjectSession,
} from "../field/management-contract.ts";
import { fields, record, segment, uuid } from "./batch.ts";
import { serialized } from "./files.ts";
import { projectDirectory, readDocument, type Document } from "./project-document.ts";
import { fieldStoragePresent, readAuthorizationStore } from "./enrollment-store.ts";
import { readFieldServerIdentity, readFieldTrust } from "./field-trust.ts";
import {
  checkSigningMedia,
  issueLocalInstallation,
  provisionFieldCenter,
  rotateFieldServer,
} from "./field-issuer.ts";
import { readUsbJson, exportInstallation } from "./field-media.ts";

export interface FieldDialogs {
  choose(kind: "csr" | "package" | "media" | "destination"): Promise<string | undefined>;
  password(): Promise<Buffer | undefined>;
  confirm(action: string, details: string): Promise<boolean>;
}

export interface FieldCaller {
  owner: object;
  storageRoot: string;
  assertCurrent(): void;
}

class FieldFailure extends Error {
  constructor(readonly code: FieldError) {
    super(code);
  }
}
function requireScope(condition: unknown): asserts condition {
  if (!condition) throw new FieldFailure("scope_changed");
}

function summary(a: AuthorizationAssignment): FieldAssignment {
  return {
    id: a.id,
    deviceId: a.deviceId,
    hardwareId: a.hardwareId,
    fingerprint: a.fingerprint,
    installationId: a.installationId,
    capabilities: a.capabilities,
    state: a.state,
    authorizationGeneration: a.authorizationGeneration,
  };
}

async function document(root: string, project: string) {
  return readDocument(join(await projectDirectory(root, project), "world.json"), project);
}

function currentBinding(doc: Document, row: AuthorizationAssignment) {
  try {
    verifyAssignmentBinding(doc.world, doc.statusEpoch ?? 0, row);
    return true;
  } catch (error) {
    if (error instanceof FieldAuthorizationDenied) return false;
    throw error;
  }
}

async function assignment(root: string, id: string) {
  const a = (await readAuthorizationStore(root)).assignments.find((a) => a.id === id);
  requireScope(a);
  return a;
}

async function predecessor(root: string, a: InstallationApproval) {
  if (a.change.kind === "begin") return undefined;
  const parent = await assignment(root, a.change.assignmentId);
  requireScope(
    a.change.kind === "reassign"
      ? parent.projectId !== a.projectId
      : parent.projectId === a.projectId && parent.deviceId === a.deviceId
  );
  return {
    project: parent.projectId,
    device: parent.deviceId,
    assignmentId: parent.id,
    fingerprint: parent.fingerprint,
  };
}

async function checkTarget(root: string, a: InstallationApproval) {
  const { world } = await document(root, a.projectId);
  const device = world.devices[a.deviceId];
  requireScope(
    world.revision === a.expectedRevision &&
      device?.source === "physical" &&
      a.capabilities.every((id) => device.capabilities.includes(id)) &&
      (a.change.kind === "rebindHardware"
        ? device.hardwareId !== a.hardwareId
        : device.hardwareId === undefined || device.hardwareId === a.hardwareId)
  );
}

function nativePrompts(dialogs: FieldDialogs, check: () => void) {
  const choose = async (kind: Parameters<FieldDialogs["choose"]>[0]) => {
    check();
    const path = await dialogs.choose(kind);
    check();
    if (!path) throw new FieldFailure("cancelled");
    return path;
  };
  const confirm = async (operation: string, details: object) => {
    check();
    // Escape directional controls so the native dialog faithfully displays untrusted labels.
    const text = JSON.stringify(details, null, 2).replace(
      /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
    );
    if (!(await dialogs.confirm(operation, text))) throw new FieldFailure("cancelled");
    check();
  };
  return { choose, confirm, password: () => dialogs.password() };
}
type LocalRequest = ProjectSession &
  ReturnType<typeof nativePrompts> & { owner: object; root: string; check: () => void };

interface Review {
  session: string;
  approval: InstallationApproval;
  usb: unknown;
  expires: number;
}

export class FieldManagement {
  private reviews = new WeakMap<object, Review>();
  private busy = false;

  constructor(
    readonly control: FieldReceiverControl,
    private dialogs: (caller: FieldCaller) => FieldDialogs
  ) {}

  private async state(root: string, project: string, origin?: string): Promise<FieldState> {
    const { enabled, listening, serverFingerprint, endpoint } = this.control.status();
    const state: FieldState = {
      enabled,
      listening,
      ...(endpoint ? { endpoint } : {}),
      ca: "absent",
      assignments: [],
    };
    if (!(await fieldStoragePresent(root))) return state;
    const trust = await readFieldTrust(root).catch(() => undefined);
    if (!trust) return { ...state, ca: "unavailable" };
    state.ca = "ready";
    state.caFingerprint = trust.fingerprint;
    const server = origin
      ? (await readFieldServerIdentity(root, origin).catch(() => undefined))?.fingerprint
      : listening
        ? serverFingerprint
        : undefined;
    if (server) state.serverFingerprint = server;

    const dir = await projectDirectory(root, project);
    try {
      state.assignments = await serialized(dir, async () => {
        const doc = await readDocument(join(dir, "world.json"), project);
        const store = await readAuthorizationStore(root);
        return store.assignments
          .filter((a) => a.projectId === project && a.state !== "revoked" && currentBinding(doc, a))
          .map(summary);
      });
    } catch {
      state.assignmentError = "unavailable";
    }
    return state;
  }

  private async provision(
    input: Record<string, unknown>,
    { project, root, check, choose, confirm, password }: LocalRequest
  ): Promise<FieldResults["provision"]> {
    fields(input, ["action", "origin"]);
    const origin = input["origin"];
    if (typeof origin !== "string") throw new FieldFailure("invalid_request");
    httpsHost(origin);
    // A partial first write stays an existing history; only a truly virgin center may provision.
    if (await fieldStoragePresent(root)) throw new FieldFailure("unavailable");
    if (this.control.needsDrain() || this.control.status().enabled)
      throw new FieldFailure("unavailable");
    const directory = await choose("media");
    await confirm("provision", { project, origin, media: directory });
    const passphrase = await password();
    if (!passphrase) throw new FieldFailure("cancelled");
    try {
      await checkSigningMedia(root, { directory, passphrase });
      return await this.control.maintenance(root, () =>
        provisionFieldCenter(root, { directory, passphrase }, origin, check)
      );
    } finally {
      passphrase.fill(0);
    }
  }

  private async rotateServer(
    input: Record<string, unknown>,
    { project, root, check, choose, confirm, password }: LocalRequest
  ): Promise<FieldResults["rotateServer"]> {
    fields(input, ["action", "origin"]);
    const origin = input["origin"];
    if (typeof origin !== "string") throw new FieldFailure("invalid_request");
    httpsHost(origin);
    // Rotation is a stopped-receiver recovery path; active sessions keep their current identity.
    if (this.control.needsDrain() || this.control.status().enabled)
      throw new FieldFailure("unavailable");
    await Promise.all([readFieldTrust(root), readAuthorizationStore(root)]).catch(() => {
      throw new FieldFailure("unavailable");
    });
    const directory = await choose("media");
    await confirm("rotateServer", { project, origin, media: directory });
    const passphrase = await password();
    if (!passphrase) throw new FieldFailure("cancelled");
    try {
      await checkSigningMedia(root, { directory, passphrase });
      if (this.control.needsDrain() || this.control.status().enabled)
        throw new FieldFailure("unavailable");
      const serverFingerprint = await this.control.manage(root, async () => {
        check();
        // A start can race the native dialogs; never replace identity under a live or configured receiver.
        const { enabled, listening } = this.control.status();
        if (enabled || listening) throw new FieldFailure("unavailable");
        return await rotateFieldServer(root, { directory, passphrase }, origin, check);
      });
      return { serverFingerprint };
    } finally {
      passphrase.fill(0);
    }
  }

  private async receiver(
    action: "start" | "stop",
    input: Record<string, unknown>,
    { project, confirm }: LocalRequest
  ): Promise<FieldResults["start"]> {
    fields(input, action === "stop" ? ["action"] : ["action", "endpoint"]);
    let endpoint: FieldEndpoint | undefined;
    if (action === "start") {
      fields(input["endpoint"], ["address", "port", "origin"]);
      endpoint = input["endpoint"] as unknown as FieldEndpoint;
      validateEndpoint(endpoint);
    }
    await confirm(action, { project, ...endpoint });
    if (endpoint) await this.control.start(endpoint);
    else await this.control.stop();
    return { listening: this.control.status().listening };
  }

  private async inspect(
    input: Record<string, unknown>,
    { owner, project, session, root, choose, check }: LocalRequest
  ): Promise<FieldResults["inspect"]> {
    fields(input, [
      "action",
      "deviceId",
      "revision",
      "hardwareId",
      "capabilities",
      "origin",
      "change",
    ]);
    segment(input["deviceId"]);
    this.reviews.delete(owner);
    const usb = await readUsbJson(await choose("csr"), root);
    const csr = inspectUsbRequest(usb);
    const trust = await readFieldTrust(root);
    const approval = parseApproval({
      operationId: randomUUID(),
      projectId: project,
      deviceId: input["deviceId"],
      hardwareId: input["hardwareId"],
      capabilities: input["capabilities"],
      expectedRevision: input["revision"],
      httpsOrigin: input["origin"],
      change: input["change"],
      installationId: csr.installationId,
      publicKeyFingerprint: csr.fingerprint,
      caFingerprint: trust.fingerprint,
    });
    await checkTarget(root, approval);
    await predecessor(root, approval);
    check();
    this.reviews.set(owner, {
      session,
      approval,
      usb,
      expires: performance.now() + 300000,
    });
    return { reviewId: approval.operationId, approval };
  }

  private async issue(
    input: Record<string, unknown>,
    { owner, project, session, root, check, choose, confirm, password }: LocalRequest
  ): Promise<FieldResults["issue"]> {
    fields(input, ["action", "reviewId"]);
    uuid(input["reviewId"]);
    const review = this.reviews.get(owner);
    requireScope(review);
    const current = () => {
      check();
      requireScope(
        review.session === session &&
          review.approval.projectId === project &&
          review.approval.operationId === input["reviewId"] &&
          performance.now() < review.expires
      );
    };
    current();
    const { approval, usb } = review;
    const directory = await choose("media");
    const dest = await choose("destination");
    const parent = await predecessor(root, approval);
    await confirm("issue", { approval, predecessor: parent, destination: dest });
    const passphrase = await password();
    if (!passphrase) throw new FieldFailure("cancelled");
    try {
      const data = await this.control.manage(root, async () => {
        await checkTarget(root, approval);
        await readFieldServerIdentity(root, approval.httpsOrigin);
        current();
        const pkg = await issueLocalInstallation(
          root,
          { directory, passphrase },
          usb,
          approval,
          current
        );
        const filename = await exportInstallation(dest, root, approval.operationId, pkg, current);
        return {
          filename,
          fingerprint: verifyInstallation(pkg, approval.caFingerprint).certificateFingerprint,
        };
      });
      this.reviews.delete(owner);
      return data;
    } finally {
      passphrase.fill(0);
    }
  }

  private async enroll(
    input: Record<string, unknown>,
    { project, root, choose, confirm, check }: LocalRequest
  ): Promise<FieldResults["enroll"]> {
    fields(input, ["action", "deviceId"]);
    segment(input["deviceId"]);
    const pkg = await readUsbJson(await choose("package"), root);
    const trust = await readFieldTrust(root);
    const { approval, certificateFingerprint } = verifyInstallation(pkg, trust.fingerprint);
    requireScope(approval.projectId === project && approval.deviceId === input["deviceId"]);
    const parent = await predecessor(root, approval);
    await confirm("enroll", { approval, certificateFingerprint, predecessor: parent });
    const row = await this.control.manage(root, (admin) => admin.enroll(pkg, check));
    return summary(row);
  }

  private async change(
    action: "complete" | "revoke",
    input: Record<string, unknown>,
    { project, root, confirm, check }: LocalRequest
  ): Promise<FieldResults["complete"]> {
    fields(input, ["action", "deviceId", "assignmentId"]);
    segment(input["deviceId"]);
    uuid(input["assignmentId"]);
    const row = await assignment(root, input["assignmentId"]);
    requireScope(
      row.projectId === project &&
        row.deviceId === input["deviceId"] &&
        (action === "complete" ? row.state === "pending" : row.state !== "revoked")
    );
    requireScope(currentBinding(await document(root, project), row));
    const approved = summary(row);
    await confirm(action, { project, assignment: approved });
    const result = await this.control.manage(root, (admin) =>
      admin.change(action, row.id, randomUUID(), async (current) => {
        requireScope(currentBinding(await document(root, project), current));
        check();
        requireScope(
          current.projectId === project &&
            current.statusEpoch === row.statusEpoch &&
            isDeepStrictEqual(summary(current), approved)
        );
      })
    );
    return summary(result);
  }

  private dispatch(action: unknown, input: Record<string, unknown>, context: LocalRequest) {
    if (action === "provision") return this.provision(input, context);
    if (action === "rotateServer") return this.rotateServer(input, context);
    if (action === "stop" || action === "start") return this.receiver(action, input, context);
    if (action === "inspect") return this.inspect(input, context);
    if (action === "issue") return this.issue(input, context);
    if (action === "enroll") return this.enroll(input, context);
    if (action === "complete" || action === "revoke") return this.change(action, input, context);
    throw new FieldFailure("invalid_request");
  }

  async execute(
    caller: FieldCaller,
    project: string,
    session: string,
    input: unknown
  ): Promise<FieldReply<FieldOperation["action"]>> {
    const check = () => {
      try {
        caller.assertCurrent();
      } catch {
        throw new FieldFailure("scope_changed");
      }
    };
    const root = caller.storageRoot;
    let ownsDialog = false;
    try {
      check();
      if (!record(input)) throw new FieldFailure("invalid_request");
      const action = input["action"];
      if (action === "state") {
        const hasOrigin = Object.hasOwn(input, "origin");
        fields(input, hasOrigin ? ["action", "origin"] : ["action"]);
        const origin = input["origin"];
        if (hasOrigin) {
          if (typeof origin !== "string") throw new FieldFailure("invalid_request");
          httpsHost(origin);
        }
        const data = await this.state(
          root,
          project,
          typeof origin === "string" ? origin : undefined
        );
        check();
        return { ok: true, data };
      }
      if (this.busy) throw new FieldFailure("busy");
      this.busy = ownsDialog = true;
      const dialogs = this.dialogs(caller);
      const context = {
        project,
        session,
        owner: caller.owner,
        root,
        check,
        ...nativePrompts(dialogs, check),
      };
      const data = await this.dispatch(action, input, context);
      check();
      return { ok: true, data };
    } catch (error) {
      // Filesystem, crypto and dialog errors can include local paths or sensitive arguments.
      return {
        ok: false,
        code:
          error instanceof FieldFailure
            ? error.code
            : error instanceof Error && error.message === "Unexpected Gaia command fields"
              ? "invalid_request"
              : "unavailable",
      };
    } finally {
      if (ownsDialog) this.busy = false;
    }
  }
}
