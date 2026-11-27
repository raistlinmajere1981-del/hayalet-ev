import { derBase64, sha256, verifyFieldPeer } from "../field/certificates.ts";
import { issuedCertificate, readIssuances, writeIssuances } from "./issuance-store.ts";
import { approvedEnrollmentCommand, verifyInstallation } from "../field/installation.ts";
import { readFieldTrust, usesFieldCa } from "./field-trust.ts";
import { join } from "node:path";
import { capabilityId } from "../devices/capabilities.ts";
import {
  FieldAuthorizationDenied,
  activateAuthorization,
  beginAuthorization,
  completeAuthorization,
  releaseForTransfer,
  prepareBegin,
  verifyActiveAssignment,
  type AuthorizationAssignment,
  type VerifyAuthorizationExpectation,
} from "../field/enrollment.ts";
import { validateWorld, type World } from "../spatial/world.ts";
import { record, segment, uuid } from "./batch.ts";
import { acquireDirectoryLock, serialized } from "./files.ts";
import {
  projectDirectory,
  publishManagedWorld,
  readDocument,
  requestDigest,
  type Document,
} from "./project-document.ts";
import {
  readAuthorizationStore,
  resolveVerifiedAssignment,
  revokeStoredAssignment,
  updateAuthorizationStore,
  trustedFieldRoot,
} from "./enrollment-store.ts";
function requestFields(
  input: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  if (!record(input)) throw new Error("Invalid Gaia enrollment request");
  const allowed = new Set([...required, ...optional]);
  if (
    !required.every((key) => Object.hasOwn(input, key)) ||
    Object.keys(input).some((key) => !allowed.has(key))
  )
    throw new Error("Unexpected Gaia enrollment fields");
  return input;
}

function enrollmentHardware(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 256)
    throw new Error("Invalid Gaia hardware binding");
}

function enrollmentFingerprint(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Invalid Gaia certificate fingerprint");
}

function enrollmentCapabilities(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => capabilityId(entry)) ||
    new Set(value).size !== value.length
  )
    throw new Error("Invalid Gaia authorization capabilities");
  return value;
}

function enrollmentRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid Gaia enrollment revision");
  return value;
}

// B7 must publish physical observations through this boundary. The project lock is held
// across the world re-read, authorization re-check and callback, and revoke takes the same
// lock, so a completed revocation cannot be followed by an observation with the old grant.
// The callback must not re-enter the project lock.
async function withVerifiedAssignment<T>(
  storageRoot: string,
  projectId: string,
  fingerprint: string,
  expected: VerifyAuthorizationExpectation,
  work: (world: World, statusEpoch: number, assignment: AuthorizationAssignment) => Promise<T>
): Promise<T> {
  const dir = await projectDirectory(storageRoot, projectId);
  return await serialized(dir, async () => {
    const document = await readDocument(join(dir, "world.json"), projectId);
    const statusEpoch = document.statusEpoch ?? 0;
    const assignment = await resolveVerifiedAssignment(
      storageRoot,
      document.world,
      statusEpoch,
      fingerprint,
      expected
    );
    if (!assignment) throw new FieldAuthorizationDenied("Gaia authorization is not active");
    return await work(document.world, statusEpoch, assignment);
  });
}
async function beginEnrollment(
  storageRoot: string,
  request: Record<string, unknown>,
  check?: () => void
) {
  const operationId = request["operationId"];
  uuid(operationId);
  const project = request["project"];
  segment(project);
  const deviceId = request["deviceId"];
  segment(deviceId);
  const hardwareId = request["hardwareId"];
  enrollmentHardware(hardwareId);
  const installationId = request["installationId"];
  uuid(installationId);
  const fingerprint = request["fingerprint"];
  enrollmentFingerprint(fingerprint);
  const capabilities = enrollmentCapabilities(request["capabilities"]);
  const expectedRevision = enrollmentRevision(request["expectedRevision"]);
  const renews = request["renews"];
  if (renews !== undefined) uuid(renews);

  const dir = await projectDirectory(storageRoot, project);
  return await serialized(dir, async () => {
    const doc = await readDocument(join(dir, "world.json"), project);
    check?.();
    let world = doc.world;
    let epoch = doc.statusEpoch ?? 0;
    // A caller may acknowledge the resulting revision only while this exact world receipt survives.
    const base = world.revision - 1;
    const acknowledged =
      doc.lastOperation?.id === operationId &&
      expectedRevision === world.revision &&
      doc.lastOperation.digest === requestDigest({ ...request, expectedRevision: base });
    const approvedRevision = acknowledged ? base : expectedRevision;
    const input = {
      projectId: project,
      operationId,
      deviceId,
      hardwareId,
      installationId,
      fingerprint,
      capabilities,
      expectedRevision: approvedRevision,
      ...(renews === undefined ? {} : { renews }),
      now: Date.now(),
    };
    const existing = await readAuthorizationStore(storageRoot);
    check?.();
    const replay = existing.assignments.find(
      (assignment) => assignment.beginOperationId === operationId
    );
    if (replay) {
      const result = beginAuthorization(existing, world, epoch, input);
      return {
        assignment: result.assignment,
        revision: world.revision,
        statusEpoch: epoch,
      };
    }
    assertRevision(
      doc,
      approvedRevision,
      operationId,
      requestDigest({ ...request, expectedRevision: approvedRevision })
    );
    const device = world.devices[deviceId];
    if (!device) throw new Error("Gaia authorization device mismatch");
    if (device.source !== "physical")
      throw new Error("Gaia authorization requires a physical device");
    if (device.hardwareId !== undefined && device.hardwareId !== hardwareId)
      throw new Error("Gaia hardware binding mismatch");
    if (!capabilities.every((id) => device.capabilities.includes(id)))
      throw new Error("Gaia authorization capability is outside the device inventory");

    if (device.hardwareId === undefined) {
      const candidate: World = {
        ...world,
        revision: world.revision + 1,
        devices: { ...world.devices, [deviceId]: { ...device, hardwareId } },
      };
      validateWorld(candidate);
      await updateAuthorizationStore(storageRoot, async (store) => {
        // Reject a known conflict before changing inventory. Activation always reads the store again.
        check?.();
        beginAuthorization(store, candidate, candidate.revision, input);
        return { store: prepareBegin(store, input), result: undefined };
      });
      check?.();
      const published = await publishManagedWorld(
        storageRoot,
        dir,
        doc,
        candidate,
        operationId,
        requestDigest(request)
      );
      world = published.world;
      epoch = published.statusEpoch;
    }

    const assignment = await updateAuthorizationStore(storageRoot, async (store) => {
      check?.();
      const result = beginAuthorization(store, world, epoch, input);
      return { store: result.store, result: result.assignment };
    });
    return { assignment, revision: world.revision, statusEpoch: epoch };
  });
}

async function completeEnrollment(
  storageRoot: string,
  request: Record<string, unknown>,
  certificatesRequired: boolean,
  check?: (target: AuthorizationAssignment) => void | Promise<void>
) {
  const operationId = request["operationId"];
  uuid(operationId);
  const assignmentId = request["assignmentId"];
  uuid(assignmentId);

  const stored = await readAuthorizationStore(storageRoot);
  const assignment = stored.assignments.find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error("Unknown Gaia authorization assignment");
  const dir = await projectDirectory(storageRoot, assignment.projectId);
  return await serialized(dir, async () => {
    const doc = await readDocument(join(dir, "world.json"), assignment.projectId);
    const epoch = doc.statusEpoch ?? 0;
    if (certificatesRequired) {
      const trust = await readFieldTrust(storageRoot);
      const issued = issuedCertificate(
        await readIssuances(join(storageRoot, "field", "pki")),
        assignment.beginOperationId
      );
      if (
        !issued ||
        sha256(
          verifyFieldPeer(
            derBase64(issued),
            { role: "client" },
            trust.caCertificate,
            trust.fingerprint
          ).raw
        ) !== assignment.fingerprint
      )
        throw new Error("Missing Gaia installation certificate");
    }
    const completed = await updateAuthorizationStore(storageRoot, async (store) => {
      const target = store.assignments.find((a) => a.id === assignmentId);
      if (!target) throw new Error("Unknown Gaia authorization assignment");
      await check?.(target);
      const result = completeAuthorization(store, doc.world, epoch, {
        assignmentId,
        operationId,
        now: Date.now(),
      });
      return { store: result.store, result: result.assignment };
    });
    return { assignment: completed, revision: doc.world.revision, statusEpoch: epoch };
  });
}

async function revokeEnrollment(storageRoot: string, request: Record<string, unknown>) {
  const operationId = request["operationId"];
  uuid(operationId);
  const assignmentId = request["assignmentId"];
  uuid(assignmentId);
  const assignment = await revokeStoredAssignment(storageRoot, assignmentId, operationId);
  return { assignment };
}

function assertRevision(doc: Document, expected: number, id: string, digest: string) {
  if (doc.lastOperation?.id === id) {
    if (doc.world.revision === expected + 1 && doc.lastOperation.digest === digest) return;
    throw new Error("Gaia enrollment operation content or revision conflict");
  }
  if (doc.world.revision !== expected) throw new Error("Gaia enrollment revision conflict");
}

async function transferEnrollment(
  storageRoot: string,
  request: Record<string, unknown>,
  check?: () => void
) {
  const move = request["action"] === "reassign";
  const assignmentId = request["assignmentId"],
    operationId = request["operationId"];
  uuid(assignmentId);
  uuid(operationId);
  const fingerprint = request["fingerprint"];
  enrollmentFingerprint(fingerprint);
  const digest = requestDigest(request);
  const lookup = await readAuthorizationStore(storageRoot);
  const route = lookup.assignments.find((a) => a.id === assignmentId);
  if (!route) throw new Error("Unknown Gaia authorization assignment");
  const project = move ? request["targetProject"] : route.projectId;
  const deviceId = move ? request["targetDeviceId"] : route.deviceId;
  segment(project);
  segment(deviceId);
  if (move && project === route.projectId)
    throw new Error("Gaia reassignment needs a different project");
  const sourceRevision = enrollmentRevision(
    request[move ? "expectedSourceRevision" : "expectedRevision"]
  );
  const targetRevision = move
    ? enrollmentRevision(request["expectedTargetRevision"])
    : sourceRevision;
  const hardware = request["hardwareId"];
  if (!move || hardware !== undefined) enrollmentHardware(hardware);
  const installation = request["installationId"];
  if (installation !== undefined) uuid(installation);
  const caps =
    request["capabilities"] === undefined
      ? undefined
      : enrollmentCapabilities(request["capabilities"]);

  const release = async (doc: Document, observedRevision?: number) =>
    updateAuthorizationStore(storageRoot, async (store) => {
      check?.();
      const current = store.assignments.find((a) => a.id === assignmentId);
      if (!current || current.projectId !== doc.world.id)
        throw new Error("Gaia authorization project mismatch");
      const replay = store.assignments.find((a) => a.beginOperationId === operationId);
      if (replay) {
        if (replay.predecessorId !== current.id || replay.beginDigest !== digest)
          throw new Error("Gaia authorization operation was reused with different content");
        return { store, result: current };
      }
      if (fingerprint === current.fingerprint)
        throw new Error("Gaia transfer needs a new certificate fingerprint");
      if (store.assignments.some((a) => a.fingerprint === fingerprint))
        throw new Error("Gaia certificate fingerprint already assigned or revoked");
      assertRevision(doc, sourceRevision, operationId, digest);
      if (current.state === "active")
        verifyActiveAssignment(doc.world, doc.statusEpoch ?? 0, current);
      if (!move) {
        if (current.hardwareId === hardware)
          throw new Error("Gaia hardware binding did not change");
        const device = doc.world.devices[deviceId];
        if (
          !device ||
          device.source !== "physical" ||
          !(caps ?? current.capabilities).every((c) => device.capabilities.includes(c))
        )
          throw new Error("Gaia authorization device or capability mismatch");
      }
      const hardwareId = hardware ?? current.hardwareId;
      enrollmentHardware(hardwareId);
      const closed = releaseForTransfer(
        store,
        current,
        operationId,
        digest,
        {
          projectId: project,
          deviceId,
          hardwareId,
          fingerprint,
          installationId: installation ?? current.installationId,
          capabilities: caps ?? current.capabilities,
        },
        move ? observedRevision : doc.world.revision,
        Date.now()
      );
      return { store: closed.store, result: closed.assignment };
    });
  const finish = async (dir: string, doc: Document) => {
    check?.();
    const store = await readAuthorizationStore(storageRoot);
    const replay = store.assignments.find((a) => a.beginOperationId === operationId);
    if (replay) {
      if (
        replay.projectId !== project ||
        replay.predecessorId !== assignmentId ||
        replay.beginDigest !== digest
      )
        throw new Error("Gaia authorization operation was reused with different content");
      return {
        assignment: replay,
        revision: doc.world.revision,
        statusEpoch: doc.statusEpoch ?? 0,
      };
    }
    const parent = store.assignments.find((a) => a.id === assignmentId);
    if (
      !parent?.carryTarget ||
      parent.state !== "revoked" ||
      parent.carryOperationId !== operationId ||
      parent.carryDigest !== digest ||
      parent.carryCancelled
    )
      throw new Error("Gaia transfer approval cancelled or missing");
    if (parent.carryTarget.observedRevision !== targetRevision)
      throw new Error("Gaia enrollment target revision conflict at approval");
    assertRevision(doc, targetRevision, operationId, digest);
    const { hardwareId, installationId, capabilities, authorizationGeneration } =
      parent.carryTarget;
    const device = doc.world.devices[deviceId];
    if (
      !device ||
      device.source !== "physical" ||
      !capabilities.every((c) => device.capabilities.includes(c))
    )
      throw new Error("Gaia authorization device or capability mismatch");
    if (device.hardwareId !== hardwareId) {
      if (move ? device.hardwareId !== undefined : device.hardwareId !== parent.hardwareId)
        throw new Error("Gaia hardware binding mismatch");
      const world = {
        ...doc.world,
        revision: doc.world.revision + 1,
        devices: { ...doc.world.devices, [deviceId]: { ...device, hardwareId } },
      };
      validateWorld(world);
      check?.();
      await publishManagedWorld(storageRoot, dir, doc, world, operationId, digest);
      doc = await readDocument(join(dir, "world.json"), project);
      assertRevision(doc, targetRevision, operationId, digest);
    }
    const { world, statusEpoch = 0 } = doc;
    const assignment = await updateAuthorizationStore(storageRoot, async (locked) => {
      check?.();
      const result = activateAuthorization(locked, world, statusEpoch, {
        projectId: project,
        operationId,
        deviceId,
        hardwareId,
        fingerprint,
        capabilities,
        installationId,
        lineageId: parent.lineageId,
        predecessorId: parent.id,
        authorizationGeneration,
        operationDigest: digest,
        now: Date.now(),
      });
      return { store: result.store, result: result.assignment };
    });
    return { assignment, revision: world.revision, statusEpoch };
  };
  const dir = await projectDirectory(storageRoot, project);
  if (!move)
    return serialized(dir, async () => {
      const doc = await readDocument(join(dir, "world.json"), project);
      await release(doc);
      return finish(dir, doc);
    });
  // No two project locks are held together. Only a durable, uncancelled release crosses this gap.
  if (!lookup.assignments.some((a) => a.beginOperationId === operationId)) {
    // A future revision guessed at approval must not become valid when the target catches up.
    const observed =
      route.state === "active"
        ? await serialized(
            dir,
            async () => (await readDocument(join(dir, "world.json"), project)).world.revision
          )
        : undefined;
    const sourceDir = await projectDirectory(storageRoot, route.projectId);
    await serialized(sourceDir, async () =>
      release(await readDocument(join(sourceDir, "world.json"), route.projectId), observed)
    );
  }
  return serialized(dir, async () =>
    finish(dir, await readDocument(join(dir, "world.json"), project))
  );
}

// Trusted main-process management entry point. It is deliberately not part of the room
// command list, so a renderer or a room package cannot read or mutate the authorization store.
async function enrollmentCommand(
  {
    storageRoot,
    certificatesRequired = false,
  }: { storageRoot: string; certificatesRequired?: boolean },
  request: unknown
) {
  request = structuredClone(request);
  if (!record(request)) throw new Error("Invalid Gaia enrollment request");
  const action = request["action"];
  if (action === "begin") {
    const input = requestFields(
      request,
      [
        "action",
        "operationId",
        "project",
        "deviceId",
        "hardwareId",
        "installationId",
        "fingerprint",
        "capabilities",
        "expectedRevision",
      ],
      ["renews"]
    );
    return await beginEnrollment(storageRoot, input);
  }
  if (action === "complete") {
    const input = requestFields(request, ["action", "operationId", "assignmentId"]);
    return await completeEnrollment(storageRoot, input, certificatesRequired);
  }
  if (action === "revoke") {
    const input = requestFields(request, ["action", "operationId", "assignmentId"]);
    return await revokeEnrollment(storageRoot, input);
  }
  if (action === "rebindHardware") {
    const input = requestFields(
      request,
      ["action", "operationId", "assignmentId", "hardwareId", "fingerprint", "expectedRevision"],
      ["installationId", "capabilities"]
    );
    return await transferEnrollment(storageRoot, input);
  }
  if (action === "reassign") {
    const input = requestFields(
      request,
      [
        "action",
        "operationId",
        "assignmentId",
        "targetProject",
        "targetDeviceId",
        "expectedSourceRevision",
        "expectedTargetRevision",
        "fingerprint",
      ],
      ["hardwareId", "installationId", "capabilities"]
    );
    return await transferEnrollment(storageRoot, input);
  }
  throw new Error("Unknown Gaia enrollment action");
}

// Only a locally approved USB package reaches the grant transitions on a provisioned CA center.
async function enrollLocalInstallation(storageRoot: string, input: unknown, check?: () => void) {
  const pkg = structuredClone(input);
  const trust = await readFieldTrust(storageRoot);
  const { approval, certificateFingerprint } = verifyInstallation(pkg, trust.fingerprint);
  const dir = join(storageRoot, "field", "pki");
  return serialized(dir, async () => {
    const cert = issuedCertificate(await readIssuances(dir), approval.operationId);
    if (!cert || sha256(derBase64(cert)) !== certificateFingerprint)
      throw new Error("Unknown Gaia issuance");
    if (approval.change.kind === "rebindHardware") {
      const parentId = approval.change.assignmentId;
      const parent = (await readAuthorizationStore(storageRoot)).assignments.find(
        (row) => row.id === parentId
      );
      if (parent?.projectId !== approval.projectId || parent.deviceId !== approval.deviceId)
        throw new Error("Wrong Gaia hardware replacement target");
    }
    const command = approvedEnrollmentCommand(approval, certificateFingerprint);
    const result =
      command.action === "begin"
        ? await beginEnrollment(storageRoot, command, check)
        : await transferEnrollment(storageRoot, command, check);
    if (result.assignment.state === "revoked")
      throw new Error("Gaia installation assignment was revoked");
    return result;
  });
}

async function discardUnpublishedInstallation(root: string, operationId: string) {
  uuid(operationId);
  await readFieldTrust(root);
  const dir = join(root, "field", "pki");
  return serialized(dir, async () => {
    const store = await readAuthorizationStore(root);
    if (
      store.assignments.some(
        (row) => row.beginOperationId === operationId || row.carryOperationId === operationId
      )
    )
      throw new Error("Revoke the Gaia assignment under its project lock");
    const journal = await readIssuances(dir);
    if (!journal.certificates[operationId]) throw new Error("Unknown Gaia issuance");
    if (!journal.discarded.includes(operationId)) {
      journal.discarded.push(operationId);
      await writeIssuances(dir, journal);
    }
  });
}

export interface FieldAdministration {
  enroll: (pkg: unknown, check: () => void) => Promise<AuthorizationAssignment>;
  change: (
    action: "complete" | "revoke",
    assignmentId: string,
    operationId: string,
    check: (target: AuthorizationAssignment) => void | Promise<void>
  ) => Promise<AuthorizationAssignment>;
}

// The main lifecycle owns this handle even between requests. Shutdown drains accepted work
// before another process can take responsibility for this center's sessions.
export async function openFieldAuthority(
  storageRoot: string,
  options: { certificatesRequired?: boolean } = {}
) {
  await trustedFieldRoot(storageRoot);
  const release = await acquireDirectoryLock(storageRoot, true);
  let certificatesRequired: boolean;
  try {
    certificatesRequired =
      options.certificatesRequired === true || (await usesFieldCa(storageRoot));
  } catch (error) {
    await release();
    throw error;
  }
  const running = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  const run = async <T>(work: () => Promise<T>) => {
    if (closing) throw new Error("Gaia field authority is closed");
    const task = work();
    running.add(task);
    try {
      return await task;
    } finally {
      running.delete(task);
    }
  };
  const admin: FieldAdministration = {
    enroll: async (pkg, check) =>
      (await enrollLocalInstallation(storageRoot, pkg, check)).assignment,
    change: async (action, assignmentId, operationId, check) =>
      action === "revoke"
        ? revokeStoredAssignment(storageRoot, assignmentId, operationId, check)
        : (await completeEnrollment(storageRoot, { assignmentId, operationId }, true, check))
            .assignment,
  };
  return {
    manage: <T>(work: (admin: FieldAdministration) => Promise<T>) => run(() => work(admin)),
    discardUnpublishedInstallation: (operationId: string) =>
      run(() => discardUnpublishedInstallation(storageRoot, operationId)),
    // B7 supplies only DER from a mutually authenticated socket. Recheck dates after waiting for the writer.
    withVerifiedClient: <T>(
      project: string,
      peerDer: Buffer,
      expected: VerifyAuthorizationExpectation,
      work: (world: World, epoch: number, assignment: AuthorizationAssignment) => Promise<T>
    ) =>
      run(async () => {
        if (peerDer.length > 18_000) throw new Error("Invalid Gaia peer certificate length");
        const der = Buffer.from(peerDer);
        const expectation = { ...expected };
        return withVerifiedAssignment(
          storageRoot,
          project,
          sha256(der),
          expectation,
          async (world, epoch, assignment) => {
            const trust = await readFieldTrust(storageRoot);
            try {
              verifyFieldPeer(der, { role: "client" }, trust.caCertificate, trust.fingerprint);
            } catch (cause) {
              throw new FieldAuthorizationDenied("Invalid Gaia client certificate", { cause });
            }
            return work(world, epoch, assignment);
          }
        );
      }),
    enrollLocalInstallation: (pkg: unknown) => run(() => enrollLocalInstallation(storageRoot, pkg)),
    enrollmentCommand: (input: unknown) =>
      run(async () => {
        const request = structuredClone(input);
        if (
          record(request) &&
          request["action"] !== "revoke" &&
          request["action"] !== "complete" &&
          certificatesRequired
        )
          throw new Error("Signed Gaia installation package required");
        return enrollmentCommand({ storageRoot, certificatesRequired }, request);
      }),
    withVerifiedAssignment: <T>(
      project: string,
      fingerprint: string,
      expected: VerifyAuthorizationExpectation,
      work: (world: World, epoch: number, assignment: AuthorizationAssignment) => Promise<T>
    ) =>
      run(async () => {
        if (certificatesRequired) throw new Error("Authenticated Gaia client certificate required");
        return withVerifiedAssignment(storageRoot, project, fingerprint, expected, work);
      }),
    close: () => (closing ??= Promise.allSettled([...running]).then(release)),
  };
}
