import { listenField, validateEndpoint, type FieldEndpoint } from "./receiver.ts";

type Listener = Awaited<ReturnType<typeof listenField>>;

// Configuration and ownership stay in main. Concurrent changes converge on the last
// requested state, including a suspend/quit received while PKI or bind is pending.
export class FieldReceiverControl {
  private endpoint: FieldEndpoint | undefined;
  private listener: Listener | undefined;
  private suspended = false;
  private closed = false;
  private generation = 0;
  private transition: Promise<void> | undefined;
  private monitor: NodeJS.Timeout | undefined;
  private checking: Promise<void> | undefined;

  constructor(private readonly root: () => string) {}

  needsDrain() {
    return !!(this.listener || this.transition || this.checking || this.monitor);
  }

  status() {
    return { enabled: !!this.endpoint, listening: false, ...this.listener?.status() };
  }

  start(endpoint: FieldEndpoint) {
    if (this.closed) throw new Error("Gaia field receiver is closed");
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
  }
}
