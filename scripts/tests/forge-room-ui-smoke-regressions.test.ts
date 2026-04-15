import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

class FakeElement {
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  innerHTML = "";
  id = "";
  type = "";
  placeholder = "";
  value = "";
  eventListeners = new Map<string, Array<(event?: Record<string, unknown>) => void>>();

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = ownerDocument;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = [];
    this.append(...children);
  }

  addEventListener(type: string, handler: (event?: Record<string, unknown>) => void): void {
    const handlers = this.eventListeners.get(type) ?? [];
    handlers.push(handler);
    this.eventListeners.set(type, handlers);
  }

  querySelector(selector: string): FakeElement | null {
    return findFirst(this, (element) => matchesSelector(element, selector));
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];
    walk(this, (element) => {
      if (matchesSelector(element, selector)) {
        matches.push(element);
      }
    });
    return matches;
  }
}

class FakeDocument {
  documentElement = {
    dataset: {} as Record<string, string>,
    lang: "en",
  };
  readonly body: FakeElement;

  constructor() {
    this.body = new FakeElement("body", this);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  getElementById(id: string): FakeElement | null {
    return findFirst(this.body, (element) => element.id === id);
  }
}

function walk(root: FakeElement, visit: (element: FakeElement) => void): void {
  visit(root);
  for (const child of root.children) {
    walk(child, visit);
  }
}

function findFirst(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement | null {
  if (predicate(root)) {
    return root;
  }

  for (const child of root.children) {
    const match = findFirst(child, predicate);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  const panelMatch = selector.match(/^\[data-forge-panel=['"]([^'"]+)['"]\]$/);
  if (panelMatch) {
    return element.dataset["forgePanel"] === panelMatch[1];
  }

  if (selector.startsWith("#")) {
    return element.id === selector.slice(1);
  }

  return false;
}

function createMinimalForgeUiEnvironment() {
  const document = new FakeDocument();
  const app = document.createElement("div");
  app.id = "app";
  document.body.append(app);

  const sentCommands: string[] = [];
  let hostMessageHandler: ((message: Record<string, unknown>) => void) | null = null;
  let readyPayload: Record<string, unknown> | null = null;

  const descriptors = {
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      language: "en-US",
    },
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: document,
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      document,
      roomAPI: {
        onHostMessage(handler: (message: Record<string, unknown>) => void) {
          hostMessageHandler = handler;
        },
        ready(payload: Record<string, unknown>) {
          readyPayload = payload;
        },
        sendCommand(command: string) {
          sentCommands.push(command);
          return true;
        },
      },
    },
  });

  return {
    app,
    emitHostMessage(message: Record<string, unknown>) {
      hostMessageHandler?.(message);
    },
    readyPayload() {
      return readyPayload;
    },
    restore() {
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      });
    },
    sentCommands,
  };
}

test("forge-room installed UI shell renders the Phase 2 panel controls under a minimal runtime", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("forge-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?smoke=${Date.now()}`
    );

    environment.emitHostMessage({
      type: "host-context",
      room: {
        id: "forge-room",
        name: "Forge Room",
      },
      activeFeature: {
        id: "forge-workbench",
      },
      locale: "en",
      translations: {
        workbench: {
          title: "Forge Workbench",
        },
      },
      user: {
        nickname: "Operator",
      },
    });

    environment.emitHostMessage({
      type: "forge-state",
      snapshot: {
        activeSessionId: "forge-session-smoke",
        currentGoal: {
          id: "forge-goal-smoke",
          summary: "Repair Room integration",
          brief: "Prepare the first Forge session.",
          constraints: ["Keep the scope local."],
          acceptanceCriteria: ["Repair Room can read the handoff package."],
          status: "draft-ready",
          targetRoomId: "repair-room",
          createdAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-15T00:00:00.000Z",
        },
        draftTasks: [
          {
            id: "forge-task-draft-1",
            parentTaskId: null,
            level: 1,
            title: "Frame boundary",
            summary: "Define the seam.",
            executionKind: "task",
            dependsOnTaskIds: [],
            assignable: true,
            dispatchMode: "compare",
            seatId: "ai1",
            roleId: "architect",
            compareSeatIds: ["ai2"],
            personaPresetId: "rovo",
            status: "draft",
          },
          {
            id: "forge-task-draft-1-checklist",
            parentTaskId: "forge-task-draft-1",
            level: 2,
            title: "Map fields",
            summary: "Checklist item.",
            executionKind: "checklist",
            dependsOnTaskIds: [],
            assignable: false,
            dispatchMode: "single-owner",
            seatId: null,
            roleId: null,
            compareSeatIds: [],
            personaPresetId: null,
            status: "draft",
          },
        ],
        draftSourceText: null,
        validationMessages: [],
        approvedTasks: [
          {
            id: "forge-task-approved-1",
            parentTaskId: null,
            level: 1,
            title: "Prepare export",
            summary: "Shape the final handoff.",
            executionKind: "task",
            dependsOnTaskIds: [],
            assignable: true,
            dispatchMode: "single-owner",
            seatId: "ai1",
            roleId: "architect",
            compareSeatIds: [],
            personaPresetId: "gok",
            status: "approved",
          },
        ],
        assignments: [
          {
            id: "forge-assignment-1",
            taskId: "forge-task-approved-1",
            mode: "single-owner",
            seatId: "ai1",
            roleId: "architect",
            personaPresetId: "gok",
            requestId: "forge-request-1",
            startedAt: null,
            status: "queued",
            queuedAt: "2026-04-15T00:00:00.000Z",
            responseId: null,
            errorMessage: null,
            archiveRef: null,
            completedAt: null,
          },
        ],
        exports: [],
        responses: [],
        conflicts: [],
        syntheses: [],
        selectedSynthesisId: null,
        coordinatorState: {
          actorId: "coordinator",
          planStatus: "awaiting-approval",
          assignmentQueueTotal: 0,
          pendingAssignmentCount: 0,
          completedResponseCount: 0,
          pendingConflictCount: 0,
          synthesisStatus: "idle",
          exportReady: false,
          lastExportPath: null,
          note: "Coordinator is waiting for the first approval.",
          lastUpdatedAt: "2026-04-15T00:00:00.000Z",
        },
        sessionList: [],
      },
      meta: {
        roleCatalog: {
          architect: {
            id: "architect",
            label: "Architect",
            localActor: false,
          },
          challenger: {
            id: "challenger",
            label: "Challenger",
            localActor: false,
          },
          "external-perspective": {
            id: "external-perspective",
            label: "External Perspective",
            localActor: false,
          },
        },
        personaPresets: {
          gok: {
            id: "gok",
            label: "Gok",
          },
          rovo: {
            id: "rovo",
            label: "Rovo",
          },
        },
      },
    });

    const panelIds = [
      "goal",
      "draft",
      "approved",
      "responses",
      "conflicts",
      "synthesis",
      "coordinator",
    ];
    panelIds.forEach((panelId) => {
      assert.ok(
        environment.app.querySelector(`[data-forge-panel="${panelId}"]`),
        `Expected panel ${panelId} to render`
      );
    });

    assert.deepEqual(environment.readyPayload(), {
      room: "forge-room",
      feature: "forge-workbench",
      stage: "ui-ready",
    });
    assert.ok(environment.sentCommands.includes("ForgeRoomUiReady"));
    assert.ok(environment.app.querySelector("#forge-draft-title-forge-task-draft-1"));
    assert.ok(environment.app.querySelector("#forge-approved-mode-forge-task-approved-1"));
  } finally {
    await installedCopy.cleanup();
    environment.restore();
  }
});
