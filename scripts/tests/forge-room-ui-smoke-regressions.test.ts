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

function findElementsByClass(root: FakeElement, className: string): FakeElement[] {
  const matches: FakeElement[] = [];
  walk(root, (element) => {
    const classNames = element.className.split(/\s+/).filter(Boolean);
    if (classNames.includes(className)) {
      matches.push(element);
    }
  });
  return matches;
}

function readTreeText(root: FakeElement): string {
  const parts: string[] = [];
  walk(root, (element) => {
    if (element.textContent.trim() !== "") {
      parts.push(element.textContent.trim());
    }
  });
  return parts.join(" ");
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
        exportSummary: {
          acceptanceCriteriaCount: 0,
          exportReady: false,
          missingRequirements: ["Select a synthesis"],
          openConflictCount: 0,
          reason: "Export blocked: Select a synthesis.",
          selectedSynthesisId: null,
          status: "blocked",
          targetRoomId: "repair-room",
        },
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

    const panelIds = ["goal", "approved", "responses", "synthesis", "coordinator"];
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
    assert.ok(environment.app.querySelector("#forge-goal-summary"));
    assert.ok(environment.app.querySelector("#forge-approved-mode-forge-task-approved-1"));

    const primaryButtons = findElementsByClass(environment.app, "forge-button--primary");
    assert.equal(primaryButtons.length, 1);
    assert.equal(primaryButtons[0]?.textContent, "Dispatch assignments");

    const uiText = readTreeText(environment.app);
    assert.match(uiText, /State Approved/);
    assert.match(uiText, /DISPATCH READY/);
    assert.match(uiText, /CENTER GATE LOCKED/);
    assert.match(uiText, /REQUIRES: DISPATCH/);
    assert.match(uiText, /OUTPUT GATE LOCKED/);
    assert.match(uiText, /REQUIRES: RESPONSES/);
    assert.doesNotMatch(uiText, /Export blocked:/);
    assert.doesNotMatch(uiText, /Check handoff/);
    assert.doesNotMatch(uiText, /Export handoff/);

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
          status: "synthesis-ready",
          targetRoomId: "repair-room",
          createdAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-15T00:10:00.000Z",
        },
        draftTasks: [],
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
            dispatchMode: "compare",
            seatId: "ai1",
            roleId: "architect",
            compareSeatIds: ["ai2"],
            personaPresetId: "gok",
            status: "answered",
          },
        ],
        assignments: [
          {
            id: "forge-assignment-1",
            taskId: "forge-task-approved-1",
            mode: "compare",
            seatId: "ai1",
            roleId: "architect",
            personaPresetId: "gok",
            requestId: "forge-request-1",
            startedAt: "2026-04-15T00:02:00.000Z",
            status: "completed",
            queuedAt: "2026-04-15T00:00:00.000Z",
            responseId: "forge-response-1",
            errorMessage: null,
            archiveRef: null,
            completedAt: "2026-04-15T00:03:00.000Z",
          },
          {
            id: "forge-assignment-2",
            taskId: "forge-task-approved-1",
            mode: "compare",
            seatId: "ai2",
            roleId: "challenger",
            personaPresetId: "rovo",
            requestId: "forge-request-2",
            startedAt: "2026-04-15T00:02:00.000Z",
            status: "completed",
            queuedAt: "2026-04-15T00:00:00.000Z",
            responseId: "forge-response-2",
            errorMessage: null,
            archiveRef: null,
            completedAt: "2026-04-15T00:03:30.000Z",
          },
        ],
        exports: [],
        exportSummary: {
          acceptanceCriteriaCount: 1,
          exportReady: false,
          missingRequirements: ["Resolve the open conflict"],
          openConflictCount: 1,
          reason: "Export blocked: Resolve the open conflict.",
          selectedSynthesisId: null,
          status: "blocked",
          targetRoomId: "repair-room",
        },
        responses: [
          {
            id: "forge-response-1",
            assignmentId: "forge-assignment-1",
            taskId: "forge-task-approved-1",
            seatId: "ai1",
            roleId: "architect",
            personaPresetId: "gok",
            summary: "Lead with a compact export contract.",
            body: "Create the export around a compact contract first.",
            rawText: "Create the export around a compact contract first.",
            archiveRef: null,
            artifacts: [],
            status: "captured",
            createdAt: "2026-04-15T00:03:00.000Z",
          },
          {
            id: "forge-response-2",
            assignmentId: "forge-assignment-2",
            taskId: "forge-task-approved-1",
            seatId: "ai2",
            roleId: "challenger",
            personaPresetId: "rovo",
            summary: "Favor a wider checklist before export.",
            body: "Add a broader checklist before packaging the handoff.",
            rawText: "Add a broader checklist before packaging the handoff.",
            archiveRef: null,
            artifacts: [],
            status: "captured",
            createdAt: "2026-04-15T00:03:30.000Z",
          },
        ],
        conflicts: [
          {
            id: "forge-conflict-1",
            taskId: "forge-task-approved-1",
            kind: "approach",
            status: "open",
            summary: "The two answers disagree on how much contract detail should ship first.",
            responseIds: ["forge-response-1", "forge-response-2"],
            preferredResponseId: null,
            resolutionNote: null,
            createdAt: "2026-04-15T00:04:00.000Z",
          },
        ],
        syntheses: [],
        selectedSynthesisId: null,
        coordinatorState: {
          actorId: "coordinator",
          planStatus: "reviewing-conflicts",
          assignmentQueueTotal: 0,
          pendingAssignmentCount: 0,
          completedResponseCount: 2,
          pendingConflictCount: 1,
          synthesisStatus: "blocked",
          exportReady: false,
          lastExportPath: null,
          note: "A decision is needed before synthesis.",
          lastUpdatedAt: "2026-04-15T00:04:00.000Z",
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

    const conflictButtons = findElementsByClass(environment.app, "forge-button--primary");
    assert.equal(conflictButtons.length, 1);
    assert.equal(conflictButtons[0]?.textContent, "Resolve decision");

    const conflictText = readTreeText(environment.app);
    assert.match(conflictText, /State Conflict/);
    assert.match(conflictText, /CENTER GATE BLOCKED/);
    assert.match(conflictText, /REQUIRES: CONFLICT RESOLUTION/);
    assert.match(conflictText, /SELECT ONE RESPONSE/);
    assert.match(conflictText, /OUTPUT GATE BLOCKED/);
  } finally {
    await installedCopy.cleanup();
    environment.restore();
  }
});
