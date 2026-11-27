import type { FieldOperation, FieldReply, ProjectSession } from "../field/management-contract.ts";
import { agePhysicalView, type GaiaStatusReply } from "../devices/field-view.ts";
import type { VirtualUpdate } from "../devices/status.ts";
import { command } from "./client.ts";

export function fieldCommand<T extends FieldOperation>(scope: ProjectSession, operation: T) {
  return command<FieldReply<T["action"]>>("GaiaField", {
    project: scope.project,
    session: scope.session,
    operation,
  });
}

export class FieldStatusReader {
  private generation = 0;
  constructor(
    private read = (scope: ProjectSession, update?: VirtualUpdate) =>
      command<GaiaStatusReply>("GaiaStatus", update ? { ...scope, update } : scope),
    private mono = () => performance.now()
  ) {}

  private snapshot?: { scope: ProjectSession; sent: number; reply: GaiaStatusReply };

  cancel() {
    this.generation++;
    delete this.snapshot;
  }

  async load({ project, session }: ProjectSession, update?: VirtualUpdate) {
    const generation = ++this.generation;
    const sent = this.mono();
    try {
      const reply = await this.read({ project, session }, update);
      if (generation !== this.generation) return false;
      this.snapshot = { scope: { project, session }, sent, reply };
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      delete this.snapshot;
      throw error;
    }
  }

  current(scope: ProjectSession, revision: number) {
    const snapshot = this.snapshot;
    if (
      !snapshot ||
      snapshot.scope.project !== scope.project ||
      snapshot.scope.session !== scope.session ||
      snapshot.reply.revision !== revision
    )
      return;
    const elapsed = this.mono() - snapshot.sent;
    const { statuses = {}, physical = {}, physicalError } = snapshot.reply;
    return {
      ...(physicalError ? { physicalError } : {}),
      project: scope.project,
      revision,
      statuses,
      physical: Object.fromEntries(
        Object.entries(physical).map(([id, row]) => [id, agePhysicalView(row, elapsed)])
      ),
    };
  }
}
