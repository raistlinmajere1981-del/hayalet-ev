import test from "node:test";
import assert from "node:assert/strict";

import { createLabEventBus } from "../../rooms/laboratory/runtime/lab-event-bus.ts";
import { createLabRunController } from "../../rooms/laboratory/runtime/lab-run-controller.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { createAudioAnalysisLocalProcessRunners } from "../../rooms/laboratory/features/audio-analysis/host/process-local-runners.ts";
import { createLaboratoryManagedAudioRunnerRuntime } from "../../rooms/laboratory/shared/host/process-managed-audio-runner.ts";
import { createLaboratoryManagedMediaRunnerRuntime } from "../../rooms/laboratory/shared/host/process-managed-media-runner.ts";
import { createLaboratoryProcessTargetingRuntime } from "../../rooms/laboratory/shared/host/process-targeting.ts";

class FakeSettingsDocument {
  private listenerSets = new Map<string, Set<(event: Event) => void>>();
  listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handler =
      typeof listener === "function"
        ? (listener)
        : (event: Event) => { listener.handleEvent(event); };
    const listeners = this.listenerSets.get(type) ?? new Set<(event: Event) => void>();
    listeners.add(handler);
    this.listenerSets.set(type, listeners);
    this.listeners.set(type, (event: Event) => {
      Array.from(this.listenerSets.get(type) ?? []).forEach(function (candidate) {
        candidate(event);
      });
    });
  }

  querySelector(): null {
    return null;
  }
}

class FakeActionElement {
  dataset: Record<string, string>;

  constructor(action: string, value?: string) {
    this.dataset = {
      labAction: action,
      ...(value === undefined ? {} : { labValue: value }),
    };
  }

  closest(selector: string): FakeActionElement | null {
    return selector === "[data-lab-action]" ? this : null;
  }

  getAttribute(name: string): string | null {
    if (name === "data-lab-action") {
      return this.dataset["labAction"] ?? null;
    }
    if (name === "data-lab-value") {
      return this.dataset["labValue"] ?? null;
    }
    return null;
  }
}

class FakeInputElement {
  checked: boolean;
  dataset: Record<string, string>;

  constructor(
    field: string,
    public value: string,
    public type = "text",
    checked = false
  ) {
    this.checked = checked;
    this.dataset = {
      labField: field,
    };
  }
}

class FakeSelectElement {
  dataset: Record<string, string>;

  constructor(
    field: string,
    public value: string
  ) {
    this.dataset = {
      labField: field,
    };
  }
}

class FakeTextAreaElement {}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function updateProcessModule(
  processRecord: Record<string, unknown>,
  moduleId: string,
  patch: Record<string, unknown>
) {
  const modules = Array.isArray(processRecord["modules"])
    ? (processRecord["modules"] as Array<Record<string, unknown>>)
    : [];
  processRecord["modules"] = modules.map(function (entry) {
    return entry["id"] === moduleId ? { ...entry, ...patch } : entry;
  });
  return processRecord;
}
