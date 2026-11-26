import type { DeviceStatuses, StatusSnapshot, VirtualUpdate } from "../../devices/status.ts";
import { freshForMs, observationFreshness } from "../../devices/status.ts";

export interface StatusReading {
  statuses: DeviceStatuses;
  revision: number;
}

export interface StatusSessionHooks {
  read: (request: {
    project: string;
    session: string;
    update?: VirtualUpdate;
  }) => Promise<StatusReading>;
  active: () => boolean;
  now: () => number;
  busy: (value: boolean) => void;
  error: (value: boolean) => void;
  observed: (value: number) => void;
  snapshot: (value: StatusSnapshot | undefined) => void;
}

// Status reads are gated by component visibility and draft revision, so overlapping requests are
// normal. Only the newest request may publish a snapshot or clear the busy/error indicators.
export class StatusSession {
  #request = 0;
  #hooks: StatusSessionHooks;

  constructor(hooks: StatusSessionHooks) {
    this.#hooks = hooks;
  }

  async load(project: string, session: string, update?: VirtualUpdate): Promise<boolean> {
    const request = ++this.#request;
    this.#hooks.busy(true);
    this.#hooks.error(false);
    try {
      const result = await this.#hooks.read({
        project,
        session,
        ...(update ? { update } : {}),
      });
      if (request !== this.#request || !this.#hooks.active()) return false;
      this.#hooks.snapshot({
        project,
        revision: result.revision,
        statuses: result.statuses ?? {},
      });
      this.#hooks.observed(this.#hooks.now());
      return true;
    } catch {
      if (request !== this.#request || !this.#hooks.active()) return false;
      this.#hooks.error(true);
      this.#hooks.snapshot(undefined);
      return false;
    } finally {
      if (request === this.#request) this.#hooks.busy(false);
    }
  }

  cancel(): void {
    this.#request++;
    this.#hooks.busy(false);
  }
}

export function nextFreshnessDeadline(statuses: DeviceStatuses, now: number): number | undefined {
  let next = Infinity;
  for (const status of Object.values(statuses))
    for (const observation of Object.values(status.observations))
      if (
        observation.at !== undefined &&
        observationFreshness(status, observation, now) === "fresh"
      )
        next = Math.min(next, observation.at + freshForMs);
  return Number.isFinite(next) ? next : undefined;
}
