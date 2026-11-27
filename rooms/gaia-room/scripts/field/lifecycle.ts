import { listenField, validateEndpoint, type FieldEndpoint } from "./receiver.ts";

import { openFieldAuthority, type FieldAdministration } from "../storage/enrollment-service.ts";

type Listener = Awaited<ReturnType<typeof listenField>>;

// Configuration and ownership stay in main. Concurrent changes converge on the last
// requested state, including a suspend/quit received while PKI or bind is pending.
export class FieldReceiverControl {
  private endpoint: FieldEndpoint | undefined;
  private listener: Listener | undefined;
  private management: Promise<unknown> | undefined;
  private suspended = false;
  private closed = false;
  private generation = 0;
  private transition: Promise<void> | undefined;
  private monitor: NodeJS.Timeout | undefined;
  private checking: Promise<void> | undefined;

  constructor(private readonly root: () => string) {}

  needsDrain() {
    return !!(this.management || this.listener || this.transition || this.checking || this.monitor);
  }

  status() {
    return {
      enabled: !!this.endpoint,
      endpoint: this.endpoint && { ...this.endpoint },
      listening: false,
      ...this.listener?.status(),
    };
  }

  start(endpoint: FieldEndpoint) {
    if (this.closed || this.management) throw new Error("Gaia field receiver is unavailable");
    validateEndpoint(endpoint);
    this.endpoint = { ...endpoint };
    if (!this.monitor) {
      this.monitor = setInterval(() => {
        if (this.transition || this.checking || this.suspended || this.closed) return;
        this.checking = this.maintain()
          .catch(() => {})
          .finally(() => {
            this.checking = undefined;
          });
      }, 5000);
      this.monitor.unref();
    }
    return this.reload();
  }

  private async maintain() {
    const listener = this.listener;
    if (listener) {
      try {
        await listener.checkIdentity();
        return;
      } catch {
        if (this.listener !== listener) return;
      }
    }
    await this.reload();
  }

  reload() {
    this.generation++;
    this.transition ??= this.reconcile();
    return this.transition;
  }

  private async reconcile() {
    try {
      for (;;) {
        const generation = this.generation;
        const old = this.listener;
        this.listener = undefined;
        await old?.close();
        if (generation !== this.generation) continue;
        if (!this.endpoint || this.suspended || this.closed) return;
        try {
          this.listener = await listenField(this.root(), this.endpoint);
        } catch (error) {
          if (generation === this.generation) throw error;
        }
        if (generation === this.generation) return;
      }
    } finally {
      this.transition = undefined;
    }
  }

  liveReading(fingerprint: string, sessionId: string) {
    return this.listener?.liveReading(fingerprint, sessionId);
  }

  async manage<T>(root: string, work: (admin: FieldAdministration) => Promise<T>): Promise<T> {
    if (this.closed || this.suspended || root !== this.root() || this.management || this.transition)
      throw new Error("Gaia field management unavailable");
    const listener = this.listener;
    const task = listener
      ? listener.manage(work)
      : (async () => {
          const owner = await openFieldAuthority(root, { certificatesRequired: true });
          try {
            if (this.closed || this.suspended) throw new Error("Gaia field management unavailable");
            return await owner.manage(work);
          } finally {
            await owner.close();
          }
        })();
    this.management = task;
    try {
      return await task;
    } finally {
      this.management = undefined;
    }
  }

  // First provisioning holds a dedicated center owner across all writes.
  // Require a fully stopped receiver so no monitor or listener races those writes.
  maintenance<T>(root: string, work: () => Promise<T>): Promise<T> {
    if (
      this.closed ||
      this.suspended ||
      root !== this.root() ||
      this.management ||
      this.transition ||
      this.checking ||
      this.listener ||
      this.monitor ||
      this.endpoint
    )
      throw new Error("Gaia field management unavailable");
    const task = work();
    this.management = task;
    return task.finally(() => {
      if (this.management === task) this.management = undefined;
    });
  }

  private running(): Listener {
    if (!this.listener) throw new Error("Gaia field receiver is stopped");
    return this.listener;
  }

  enroll(pkg: unknown) {
    return this.running().enroll(pkg);
  }
  complete(assignmentId: string, operationId: string) {
    return this.running().complete(assignmentId, operationId);
  }

  revoke(assignmentId: string, operationId: string) {
    return this.running().revoke(assignmentId, operationId);
  }

  suspend() {
    this.suspended = true;
    return this.reload();
  }
  resume() {
    this.suspended = false;
    return this.reload();
  }

  stop() {
    this.endpoint = undefined;
    clearInterval(this.monitor);
    this.monitor = undefined;
    return this.reload();
  }

  async shutdown() {
    this.closed = true;
    await this.stop();
    await this.checking;
    await this.management?.catch(() => {});
  }
}
