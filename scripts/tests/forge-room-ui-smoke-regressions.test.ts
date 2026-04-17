import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  checked = false;
  disabled = false;
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

  const dataMatch = selector.match(/^\[data-([a-z0-9-]+)(?:=['"]([^'"]+)['"])?\]$/i);
  if (dataMatch) {
    const datasetKey = (dataMatch[1] ?? "").replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    if ((dataMatch[2] ?? "") === "") {
      return datasetKey in element.dataset;
    }
    return element.dataset[datasetKey] === dataMatch[2];
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

function fireEvent(element: FakeElement, type: string): void {
  const handlers = element.eventListeners.get(type) ?? [];
  handlers.forEach((handler) => handler({ target: element }));
}

function loadTranslations(locale: "en" | "tr"): Record<string, unknown> {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `rooms/forge-room/i18n/${locale}.json`), "utf8")
  ) as Record<string, unknown>;
}

function createMinimalForgeUiEnvironment() {
  const document = new FakeDocument();
  const app = document.createElement("div");
  app.id = "app";
  document.body.append(app);

  const sentCommands: string[] = [];
  const sentEvents: Array<{ command: string; payload: Record<string, unknown> }> = [];
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
        sendCommand(command: string, payload: Record<string, unknown> = {}) {
          sentCommands.push(command);
           sentEvents.push({ command, payload });
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
    sentEvents,
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
      translations: loadTranslations("en"),
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
        operatorProfile: {
          schemaVersion: 1,
          updatedAt: "2026-04-15T00:00:00.000Z",
          skill: {
            level: null,
            soldering: null,
            measurement: "basic",
            mechanical: null,
          },
          tools: {
            multimeter: false,
            solderingIron: null,
            hotAir: null,
            benchPowerSupply: null,
            magnification: null,
          },
          preferences: {
            mode: "learn-first",
            riskTolerance: null,
          },
        },
        preflight: {
          bundle: null,
          errorMessage: null,
          promptCharCount: 0,
          ranAt: null,
          staleReason: null,
          status: "stale",
          warnings: [],
        },
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
        sessionContextSelection: {
          skill: {
            level: false,
            soldering: false,
            measurement: true,
            mechanical: false,
          },
          tools: {
            multimeter: true,
            solderingIron: false,
            hotAir: false,
            benchPowerSupply: false,
            magnification: false,
          },
          preferences: {
            mode: true,
            riskTolerance: false,
          },
        },
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
    assert.equal(environment.app.querySelector("#forge-goal-brief"), null);
    assert.ok(environment.app.querySelector("[data-forge-zone='goal']"));
    assert.ok(environment.app.querySelector("[data-forge-zone='context']"));
    assert.ok(environment.app.querySelector("[data-forge-zone='overrides']"));
    assert.ok(environment.app.querySelector("[data-forge-zone='preflight']"));
    assert.ok(environment.app.querySelector("#forge-session-context-skill-level"));
    assert.ok(environment.app.querySelector("#forge-session-context-skill-measurement"));
    assert.ok(environment.app.querySelector("#forge-session-context-tool-magnification"));
    assert.ok(environment.app.querySelector("#forge-session-context-tool-multimeter"));
    assert.ok(environment.app.querySelector("#forge-approved-mode-forge-task-approved-1"));
    assert.equal(
      environment.app.querySelector("#forge-approved-capsule-summary-forge-task-approved-1"),
      null
    );

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
    assert.match(uiText, /Edit/);
    assert.match(uiText, /CONTEXT FOR THIS RUN/);
    assert.match(uiText, /Context ready/);
    assert.match(uiText, /Preflight: stale/);
    assert.match(uiText, /Measurement/);
    assert.match(uiText, /unavailable/);
    assert.match(uiText, /Advanced capsule/);
    assert.doesNotMatch(uiText, /Export blocked:/);
    assert.doesNotMatch(uiText, /Check handoff/);
    assert.doesNotMatch(uiText, /Export handoff/);

    const goalDetailsButton = environment.app.querySelector(
      "[data-forge-action='toggle-goal-details']"
    ) as FakeElement | null;
    assert.ok(goalDetailsButton);
    fireEvent(goalDetailsButton, "click");
    assert.ok(environment.app.querySelector("#forge-goal-brief"));
    const briefInput = environment.app.querySelector("#forge-goal-brief") as FakeElement | null;
    assert.ok(briefInput);
    briefInput.value = "Document the repair boundary.";
    fireEvent(briefInput, "input");
    const constraintsInput = environment.app.querySelector(
      "#forge-goal-constraints"
    ) as FakeElement | null;
    assert.ok(constraintsInput);
    constraintsInput.value = "Keep the scope local.\nPreserve host logic.";
    fireEvent(constraintsInput, "input");
    const goalDetailsCloseButton = environment.app.querySelector(
      "[data-forge-action='toggle-goal-details']"
    ) as FakeElement | null;
    assert.ok(goalDetailsCloseButton);
    fireEvent(goalDetailsCloseButton, "click");
    assert.equal(environment.app.querySelector("#forge-goal-brief"), null);

    const toggleProfileButtonsBeforeOpen = environment.app.querySelectorAll(
      "[data-forge-action='toggle-profile-editor']"
    );
    assert.equal(toggleProfileButtonsBeforeOpen.length, 1);
    fireEvent(toggleProfileButtonsBeforeOpen[0]!, "click");
    assert.match(readTreeText(environment.app), /Manage operator profile/);
    const skillLevelSelect = environment.app.querySelector(
      "#forge-profile-skill-level"
    ) as FakeElement | null;
    assert.ok(skillLevelSelect);
    skillLevelSelect.value = "advanced";
    fireEvent(skillLevelSelect, "change");
    const solderingEntry = environment.app
      .querySelectorAll("[data-forge-profile-entry='skill-soldering']")
      .find((element) => element.className.includes("forge-profile-item__toggle"));
    assert.ok(solderingEntry);
    fireEvent(solderingEntry, "click");
    const solderingSelect = environment.app.querySelector(
      "#forge-profile-soldering"
    ) as FakeElement | null;
    assert.ok(solderingSelect);
    solderingSelect.value = "good";
    fireEvent(solderingSelect, "change");
    const skillLevelEntry = environment.app
      .querySelectorAll("[data-forge-profile-entry='skill-level']")
      .find((element) => element.className.includes("forge-profile-item__toggle"));
    assert.ok(skillLevelEntry);
    fireEvent(skillLevelEntry, "click");
    const reopenedSkillLevelSelect = environment.app.querySelector(
      "#forge-profile-skill-level"
    ) as FakeElement | null;
    assert.ok(reopenedSkillLevelSelect);
    const saveProfileButton = environment.app.querySelector(
      "[data-forge-action='save-operator-profile']"
    ) as FakeElement | null;
    assert.ok(saveProfileButton);
    fireEvent(saveProfileButton, "click");
    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomUpdateOperatorProfile",
      payload: {
        skill: {
          level: "advanced",
          soldering: "good",
          measurement: "basic",
          mechanical: null,
        },
        tools: {
          multimeter: false,
          solderingIron: null,
          hotAir: null,
          benchPowerSupply: null,
          magnification: null,
        },
        preferences: {
          mode: "learn-first",
          riskTolerance: null,
        },
      },
    });
    const toggleProfileButtonsAfterOpen = environment.app.querySelectorAll(
      "[data-forge-action='toggle-profile-editor']"
    );
    assert.equal(toggleProfileButtonsAfterOpen.length, 2);
    fireEvent(toggleProfileButtonsAfterOpen[1]!, "click");
    assert.equal(
      environment.app.querySelectorAll("[data-forge-action='toggle-profile-editor']").length,
      1
    );

    const addConditionButton = environment.app.querySelector(
      "[data-forge-action='toggle-run-condition-composer']"
    ) as FakeElement | null;
    assert.ok(addConditionButton);
    fireEvent(addConditionButton, "click");
    const runConditionInput = environment.app.querySelector(
      "#forge-run-override-condition-input"
    ) as FakeElement | null;
    assert.ok(runConditionInput);
    runConditionInput.value = "Protect nearby plastic";
    fireEvent(runConditionInput, "input");
    const commitConditionButton = environment.app.querySelector(
      "[data-forge-action='commit-run-condition']"
    ) as FakeElement | null;
    assert.ok(commitConditionButton);
    fireEvent(commitConditionButton, "click");
    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomUpdateRunOverride",
      payload: {
        enableRovoPreAnalysis: false,
        notes: "Protect nearby plastic",
        tools: {
          hotAir: false,
        },
      },
    });
    const removeConditionButton = environment.app.querySelector(
      "[data-forge-remove-run-condition]"
    ) as FakeElement | null;
    assert.ok(removeConditionButton);
    fireEvent(removeConditionButton, "click");
    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomUpdateRunOverride",
      payload: {
        enableRovoPreAnalysis: false,
        notes: "",
        tools: {
          hotAir: false,
        },
      },
    });

    const multimeterSelection = environment.app.querySelector(
      "#forge-session-context-tool-multimeter"
    ) as FakeElement | null;
    assert.ok(multimeterSelection);
    fireEvent(multimeterSelection, "click");
    assert.ok(environment.sentCommands.includes("ForgeRoomUpdateSessionContext"));
    const measurementSelection = environment.app.querySelector(
      "#forge-session-context-skill-measurement"
    ) as FakeElement | null;
    assert.ok(measurementSelection);
    fireEvent(measurementSelection, "click");
    const modeSelection = environment.app.querySelector(
      "#forge-session-context-preference-mode"
    ) as FakeElement | null;
    assert.ok(modeSelection);
    fireEvent(modeSelection, "click");
    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomUpdateSessionContext",
      payload: {
        skill: {
          level: false,
          soldering: false,
          measurement: false,
          mechanical: false,
        },
        tools: {
          multimeter: false,
          solderingIron: false,
          hotAir: false,
          benchPowerSupply: false,
          magnification: false,
        },
        preferences: {
          mode: false,
          riskTolerance: false,
        },
      },
    });
    assert.match(readTreeText(environment.app), /Preflight/);
    assert.match(readTreeText(environment.app), /stale/);
    assert.match(readTreeText(environment.app), /Multimeter/);

    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomUpdateRunOverride",
      result: {
        success: true,
        message: null,
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

test("forge-room control surface renders the Turkish control copy from room translations", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("forge-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?smoke-tr=${Date.now()}`
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
      locale: "tr",
      translations: loadTranslations("tr"),
      user: {
        nickname: "Operator",
      },
    });

    environment.emitHostMessage({
      type: "forge-state",
      snapshot: {
        activeSessionId: "forge-session-tr",
        currentGoal: {
          id: "forge-goal-tr",
          summary: "Kontrol yuzeyi duzenle",
          brief: "",
          constraints: [],
          acceptanceCriteria: [],
          status: "draft",
          targetRoomId: "repair-room",
          createdAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-15T00:00:00.000Z",
        },
        draftTasks: [],
        draftSourceText: null,
        validationMessages: [],
        operatorProfile: {
          schemaVersion: 1,
          updatedAt: "2026-04-15T00:00:00.000Z",
          skill: {
            level: null,
            soldering: null,
            measurement: null,
            mechanical: null,
          },
          tools: {
            multimeter: null,
            solderingIron: null,
            hotAir: null,
            benchPowerSupply: null,
            magnification: null,
          },
          preferences: {
            mode: null,
            riskTolerance: null,
          },
        },
        preflight: {
          bundle: null,
          errorMessage: null,
          promptCharCount: 0,
          ranAt: null,
          staleReason: null,
          status: "stale",
          warnings: [],
        },
        approvedTasks: [],
        assignments: [],
        exports: [],
        exportSummary: {
          acceptanceCriteriaCount: 0,
          exportReady: false,
          missingRequirements: ["Taslak sec"],
          openConflictCount: 0,
          reason: "Export blocked: Taslak sec.",
          selectedSynthesisId: null,
          status: "blocked",
          targetRoomId: "repair-room",
        },
        responses: [],
        conflicts: [],
        syntheses: [],
        selectedSynthesisId: null,
        sessionContextSelection: {
          skill: {
            level: false,
            soldering: false,
            measurement: false,
            mechanical: false,
          },
          tools: {
            multimeter: false,
            solderingIron: false,
            hotAir: false,
            benchPowerSupply: false,
            magnification: false,
          },
          preferences: {
            mode: false,
            riskTolerance: false,
          },
        },
        coordinatorState: {
          actorId: "coordinator",
          planStatus: "idle",
          assignmentQueueTotal: 0,
          pendingAssignmentCount: 0,
          completedResponseCount: 0,
          pendingConflictCount: 0,
          synthesisStatus: "idle",
          exportReady: false,
          lastExportPath: null,
          note: "Bekliyor.",
          lastUpdatedAt: "2026-04-15T00:00:00.000Z",
        },
        sessionList: [],
        runOverride: null,
        runSignature: null,
        decisionTrace: [],
      },
      meta: {
        roleCatalog: {},
        personaPresets: {},
      },
    });

    const uiText = readTreeText(environment.app);
    assert.match(uiText, /BU RUN ICIN BAGLAM/);
    assert.match(uiText, /Baglam hazir/);
    assert.match(uiText, /Preflight: eskidi/);
    assert.match(uiText, /Sicak hava/);
    assert.match(uiText, /Tezgah kaynagi/);
    assert.match(uiText, /On analiz/);
  } finally {
    await installedCopy.cleanup();
    environment.restore();
  }
});

test("forge-room preserves hidden goal details when saving from the session-created control surface", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("forge-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?smoke-save=${Date.now()}`
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
      translations: loadTranslations("en"),
      user: {
        nickname: "Operator",
      },
    });

    environment.emitHostMessage({
      type: "forge-state",
      snapshot: {
        activeSessionId: "forge-session-save-goal",
        currentGoal: null,
        draftTasks: [],
        draftSourceText: null,
        validationMessages: [],
        operatorProfile: {
          schemaVersion: 1,
          updatedAt: "2026-04-15T00:00:00.000Z",
          skill: {
            level: null,
            soldering: null,
            measurement: null,
            mechanical: null,
          },
          tools: {
            multimeter: null,
            solderingIron: null,
            hotAir: null,
            benchPowerSupply: null,
            magnification: null,
          },
          preferences: {
            mode: null,
            riskTolerance: null,
          },
        },
        preflight: {
          bundle: null,
          errorMessage: null,
          promptCharCount: 0,
          ranAt: null,
          staleReason: null,
          status: "idle",
          warnings: [],
        },
        approvedTasks: [],
        assignments: [],
        exports: [],
        exportSummary: {
          acceptanceCriteriaCount: 0,
          exportReady: false,
          missingRequirements: ["Select a synthesis"],
          openConflictCount: 0,
          reason: "Export blocked: no selected synthesis.",
          selectedSynthesisId: null,
          status: "blocked",
          targetRoomId: "repair-room",
        },
        responses: [],
        conflicts: [],
        syntheses: [],
        selectedSynthesisId: null,
        sessionContextSelection: {
          skill: {
            level: false,
            soldering: false,
            measurement: false,
            mechanical: false,
          },
          tools: {
            multimeter: false,
            solderingIron: false,
            hotAir: false,
            benchPowerSupply: false,
            magnification: false,
          },
          preferences: {
            mode: false,
            riskTolerance: false,
          },
        },
        coordinatorState: {
          actorId: "coordinator",
          planStatus: "idle",
          assignmentQueueTotal: 0,
          pendingAssignmentCount: 0,
          completedResponseCount: 0,
          pendingConflictCount: 0,
          synthesisStatus: "idle",
          exportReady: false,
          lastExportPath: null,
          note: "Waiting for a goal.",
          lastUpdatedAt: "2026-04-15T00:00:00.000Z",
        },
        sessionList: [],
        runOverride: null,
        runSignature: null,
        decisionTrace: [],
      },
      meta: {
        roleCatalog: {},
        personaPresets: {},
      },
    });

    const goalSummaryInput = environment.app.querySelector("#forge-goal-summary") as FakeElement | null;
    assert.ok(goalSummaryInput);
    goalSummaryInput.value = "Repair Room integration";
    fireEvent(goalSummaryInput, "input");

    const goalDetailsButton = environment.app.querySelector(
      "[data-forge-action='toggle-goal-details']"
    ) as FakeElement | null;
    assert.ok(goalDetailsButton);
    fireEvent(goalDetailsButton, "click");

    const briefInput = environment.app.querySelector("#forge-goal-brief") as FakeElement | null;
    assert.ok(briefInput);
    briefInput.value = "Document the repair boundary.";
    fireEvent(briefInput, "input");

    const constraintsInput = environment.app.querySelector(
      "#forge-goal-constraints"
    ) as FakeElement | null;
    assert.ok(constraintsInput);
    constraintsInput.value = "Keep the scope local.\nPreserve host logic.";
    fireEvent(constraintsInput, "input");

    const closeDetailsButton = environment.app.querySelector(
      "[data-forge-action='toggle-goal-details']"
    ) as FakeElement | null;
    assert.ok(closeDetailsButton);
    fireEvent(closeDetailsButton, "click");
    assert.equal(environment.app.querySelector("#forge-goal-brief"), null);

    const saveGoalButton = environment.app.querySelector(
      "[data-forge-action='save-goal']"
    ) as FakeElement | null;
    assert.ok(saveGoalButton);
    fireEvent(saveGoalButton, "click");

    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomUpdateGoal",
      payload: {
        summary: "Repair Room integration",
        brief: "Document the repair boundary.",
        constraints: ["Keep the scope local.", "Preserve host logic."],
        targetRoomId: "repair-room",
      },
    });
  } finally {
    await installedCopy.cleanup();
    environment.restore();
  }
});
