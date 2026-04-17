import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

class FakeElement {
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  readonly classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    contains: (token: string) => boolean;
  };
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
    this.classList = {
      add: (...tokens: string[]) => {
        const next = new Set(this.className.split(/\s+/).filter(Boolean));
        tokens.forEach((token) => {
          if (token.trim() !== "") {
            next.add(token);
          }
        });
        this.className = Array.from(next).join(" ");
      },
      remove: (...tokens: string[]) => {
        const blocked = new Set(tokens);
        this.className = this.className
          .split(/\s+/)
          .filter((token) => token !== "" && !blocked.has(token))
          .join(" ");
      },
      contains: (token: string) => this.className.split(/\s+/).filter(Boolean).includes(token),
    };
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  insertBefore(child: FakeElement, referenceChild: FakeElement | null): void {
    child.parentElement = this;
    if (referenceChild === null) {
      this.children.push(child);
      return;
    }
    const index = this.children.indexOf(referenceChild);
    if (index === -1) {
      this.children.push(child);
      return;
    }
    this.children.splice(index, 0, child);
  }

  replaceChild(nextChild: FakeElement, previousChild: FakeElement): void {
    const index = this.children.indexOf(previousChild);
    if (index === -1) {
      nextChild.parentElement = this;
      this.children.push(nextChild);
      return;
    }
    nextChild.parentElement = this;
    previousChild.parentElement = null;
    this.children.splice(index, 1, nextChild);
  }

  remove(): void {
    if (this.parentElement === null) {
      return;
    }
    const index = this.parentElement.children.indexOf(this);
    if (index !== -1) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
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
      assistant: {
        nickname: "Hayalet",
        avatar: "/avatars/ai0.png",
        connected: true,
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

    const panelIds = ["goal", "responses", "synthesis", "coordinator"];
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
    assert.ok(environment.app.querySelector("[data-forge-stage-panel='true']"));
    assert.ok(environment.app.querySelector("[data-forge-active-stage='session']"));
    assert.ok(environment.app.querySelector("#forge-goal-summary"));
    assert.ok(environment.app.querySelector("#forge-goal-brief"));
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomCreateSession",
      result: {
        success: true,
        message: null,
      },
    });
    const statusBarActions = findElementsByClass(environment.app, "forge-statusbar__action");
    assert.equal(statusBarActions.length, 0);

    const uiText = readTreeText(environment.app);
    assert.match(uiText, /State Approved/);
    assert.match(uiText, /NEXT: DISPATCH/);
    assert.match(uiText, /CENTER GATE LOCKED/);
    assert.match(uiText, /REQUIRES: DISPATCH/);
    assert.match(uiText, /OUTPUT GATE LOCKED/);
    assert.match(uiText, /REQUIRES: RESPONSES/);
    assert.match(uiText, /Operator Profile/);
    assert.match(uiText, /Preflight/);
    assert.match(uiText, /Session \+ goal/);
    assert.match(uiText, /Previous/);
    assert.match(uiText, /Next/);
    assert.doesNotMatch(uiText, /Required action/);
    assert.doesNotMatch(uiText, /Active session attached/);
    assert.doesNotMatch(uiText, /Goal saved for this run/);
    assert.doesNotMatch(uiText, /Export blocked:/);
    assert.doesNotMatch(uiText, /Check handoff/);
    assert.doesNotMatch(uiText, /Export handoff/);

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

    const toggleProfileButtonsBeforeOpen = environment.app.querySelectorAll(
      "[data-forge-action='toggle-profile-editor']"
    );
    assert.equal(toggleProfileButtonsBeforeOpen.length, 1);
    fireEvent(toggleProfileButtonsBeforeOpen[0]!, "click");
    const profileOverlayText = readTreeText(environment.app);
    assert.match(profileOverlayText, /OPERATOR PROFILE/);
    assert.doesNotMatch(profileOverlayText, /Persistent operator records live here/);
    assert.doesNotMatch(profileOverlayText, /Autosave on close/);
    const profileGrid = findElementsByClass(environment.app, "forge-profile-grid");
    assert.equal(profileGrid.length, 1);
    const profileSectionBodies = findElementsByClass(environment.app, "forge-profile-section__body");
    assert.equal(profileSectionBodies.length, 2);

    const editEquipmentButton = environment.app
      .querySelectorAll("[data-forge-action='start-profile-edit']")
      .find(
        (element) =>
          element.dataset["forgeProfileKind"] === "equipment" &&
          element.dataset["forgeProfileKey"] === "multimeter"
      );
    assert.ok(editEquipmentButton);
    fireEvent(editEquipmentButton, "click");
    const equipmentLabelInput = environment.app.querySelector(
      "#forge-profile-editor-equipment-label"
    ) as FakeElement | null;
    assert.ok(equipmentLabelInput);
    assert.equal(equipmentLabelInput.value, "Multimeter");
    const inlineEditor = equipmentLabelInput.parentElement;
    assert.ok(inlineEditor);
    assert.equal(inlineEditor.className.includes("forge-inline-editor"), true);
    const equipmentEditorWrap = inlineEditor.parentElement;
    assert.ok(equipmentEditorWrap);
    assert.equal(equipmentEditorWrap.className.includes("forge-profile-record__editor"), true);
    const equipmentRecord = equipmentEditorWrap.parentElement;
    assert.ok(equipmentRecord);
    assert.equal(equipmentRecord.className.includes("forge-profile-record"), true);
    assert.match(readTreeText(equipmentRecord), /Multimeter/);
    const cancelProfileEntryButton = environment.app.querySelector(
      "[data-forge-action='cancel-profile-entry']"
    ) as FakeElement | null;
    assert.ok(cancelProfileEntryButton);
    fireEvent(cancelProfileEntryButton, "click");

    const addSkillButton = environment.app
      .querySelectorAll("[data-forge-action='start-profile-create']")
      .find((element) => element.dataset["forgeProfileKind"] === "skill");
    assert.ok(addSkillButton);
    fireEvent(addSkillButton, "click");
    const skillLabelInput = environment.app.querySelector(
      "#forge-profile-editor-skill-label"
    ) as FakeElement | null;
    const skillLevelSelect = environment.app.querySelector(
      "#forge-profile-editor-skill-level"
    ) as FakeElement | null;
    assert.ok(skillLabelInput);
    assert.ok(skillLevelSelect);
    skillLabelInput.value = "Soldering";
    skillLevelSelect.value = "advanced";
    const commitProfileEntryButton = environment.app.querySelector(
      "[data-forge-action='commit-profile-entry']"
    ) as FakeElement | null;
    assert.ok(commitProfileEntryButton);
    fireEvent(commitProfileEntryButton, "click");
    const toggleProfileButtonsAfterOpen = environment.app.querySelectorAll(
      "[data-forge-action='toggle-profile-editor']"
    );
    assert.equal(toggleProfileButtonsAfterOpen.length, 3);
    fireEvent(toggleProfileButtonsAfterOpen.at(-1)!, "click");
    assert.equal(environment.sentEvents.at(-1)?.command, "ForgeRoomUpdateOperatorProfile");
    const profilePayload = environment.sentEvents.at(-1)?.payload as {
      equipment?: Array<{ equipmentKey: string; label?: string; status: string }>;
      preferences?: { mode?: string };
      skills?: Array<{ label?: string; level: string; skillKey: string }>;
    };
    assert.equal(profilePayload.preferences?.mode, "learn_first");
    assert.ok(
      profilePayload.skills?.some(
        (entry) =>
          entry.label === "Soldering" &&
          entry.level === "advanced" &&
          entry.skillKey.startsWith("skill-")
      )
    );
    assert.ok(
      profilePayload.skills?.some(
        (entry) => entry.skillKey === "measurement" && entry.level === "basic"
      )
    );
    assert.deepEqual(profilePayload.equipment, [
      {
        equipmentKey: "multimeter",
        label: "Multimeter",
        status: "unavailable",
      },
    ]);
    assert.equal(toggleProfileButtonsAfterOpen.length >= 2, true);
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomUpdateOperatorProfile",
      result: {
        success: true,
        message: null,
      },
    });
    const closeProfileButton = environment.app.querySelector(
      "[data-forge-action='toggle-profile-editor']"
    ) as FakeElement | null;
    assert.ok(closeProfileButton);
    fireEvent(closeProfileButton, "click");

    const sessionStageNavButtons = environment.app.querySelectorAll("[data-forge-action='open-stage']");
    let sessionNextButton = sessionStageNavButtons.find(
      (element) => element.dataset["forgeActionValue"] === "operator"
    );
    assert.ok(sessionNextButton);
    assert.equal(sessionNextButton.disabled, false);
    fireEvent(sessionNextButton, "click");
    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomUpdateGoal",
      payload: {
        summary: "Repair Room integration",
        brief: "Document the repair boundary.",
        constraints: ["Keep the scope local.", "Preserve host logic."],
        targetRoomId: "repair-room",
      },
    });
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomUpdateGoal",
      result: {
        success: true,
        message: null,
      },
    });
    assert.ok(environment.app.querySelector("[data-forge-active-stage='operator']"));

    const stageHeaders = findElementsByClass(environment.app, "forge-stage__header");
    const sessionHeader = stageHeaders.find((element) => element.dataset["forgeActionValue"] === "session");
    assert.ok(sessionHeader);
    fireEvent(sessionHeader, "click");
    assert.equal(environment.sentEvents.at(-1)?.command, "ForgeRoomSaveSession");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomSaveSession",
      result: {
        success: true,
        message: null,
      },
    });
    assert.ok(environment.app.querySelector("[data-forge-active-stage='session']"));

    const operatorHeader = findElementsByClass(environment.app, "forge-stage__header").find(
      (element) => element.dataset["forgeActionValue"] === "operator"
    );
    assert.ok(operatorHeader);
    fireEvent(operatorHeader, "click");
    assert.equal(environment.sentEvents.at(-1)?.command, "ForgeRoomUpdateGoal");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomUpdateGoal",
      result: {
        success: true,
        message: null,
      },
    });
    assert.ok(environment.app.querySelector("[data-forge-active-stage='operator']"));

    const contextChips = environment.app.querySelectorAll("[data-forge-context-chip]");
    assert.ok(contextChips.some((element) => element.dataset["forgeContextKey"] === "measurement"));
    assert.ok(contextChips.some((element) => element.dataset["forgeContextKey"] === "multimeter"));
    assert.ok(environment.app.querySelector("#forge-run-override-mode"));
    assert.ok(environment.app.querySelector("#forge-run-override-risk"));

    const operatorStageButtons = environment.app.querySelectorAll("[data-forge-action='open-stage']");
    const preflightNextButton = operatorStageButtons.find(
      (element) => element.dataset["forgeActionValue"] === "preflight"
    );
    assert.ok(preflightNextButton);
    fireEvent(preflightNextButton, "click");
    assert.equal(environment.sentEvents.at(-1)?.command, "ForgeRoomSaveSession");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomSaveSession",
      result: {
        success: true,
        message: null,
      },
    });
    assert.ok(environment.app.querySelector("[data-forge-active-stage='preflight']"));
    assert.ok(environment.app.querySelector("[data-forge-action='run-preflight']"));
    assert.match(readTreeText(environment.app), /Hayalet/);
    assert.match(readTreeText(environment.app), /Collect AI0 software pre-analysis/);
    assert.match(readTreeText(environment.app), /Result preview/);

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
      assistant: {
        nickname: "Hayalet",
        avatar: "/avatars/ai0.png",
        connected: false,
      },
      user: {
        nickname: "Operator",
      },
    });
    environment.emitHostMessage({
      type: "forge-state",
      snapshot: {
        ...({
          activeSessionId: "forge-session-smoke",
          currentGoal: {
            id: "forge-goal-smoke",
            summary: "Repair Room integration",
            brief: "Prepare the first Forge session.",
            constraints: ["Keep the scope local."],
            acceptanceCriteria: ["Repair Room can read the handoff package."],
            status: "draft",
            targetRoomId: "repair-room",
            createdAt: "2026-04-15T00:00:00.000Z",
            updatedAt: "2026-04-15T00:10:00.000Z",
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
          assignments: [],
          exports: [],
          exportSummary: {
            acceptanceCriteriaCount: 1,
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
            note: "Coordinator is idle.",
            lastUpdatedAt: "2026-04-15T00:00:00.000Z",
          },
          sessionList: [],
          runOverride: null,
          runSignature: {
            value: "repair-room-signature",
            updatedAt: "2026-04-15T00:00:00.000Z",
            source: ["goal", "operator"],
          },
          decisionTrace: [],
        } as Record<string, unknown>),
        preflight: {
          activeStepId: null,
          bundle: {
            rovoPreAnalysis: {
              summary: "AI0 is offline",
            },
          },
          errorMessage: "AI0 is offline",
          promptCharCount: 1791,
          ranAt: "2026-04-15T00:00:00.000Z",
          staleReason: null,
          status: "warning",
          warnings: ["AI0 is offline", "AI0 is offline"],
        },
      },
      meta: {
        roleCatalog: {},
        personaPresets: {},
      },
    });
    const disabledPreflightButton = environment.app.querySelector(
      "[data-forge-action='run-preflight']"
    ) as FakeElement | null;
    assert.ok(disabledPreflightButton);
    assert.equal(disabledPreflightButton.disabled, true);
    const offlineText = readTreeText(environment.app);
    assert.equal((offlineText.match(/AI0 is offline/g) ?? []).length, 1);
    const preflightAgent = findElementsByClass(environment.app, "forge-preflight-agent")[0] ?? null;
    assert.ok(preflightAgent);
    assert.equal(
      findElementsByClass(preflightAgent, "forge-profile-identity__avatar--fallback").length,
      0
    );
    assert.ok(
      findElementsByClass(preflightAgent, "forge-profile-identity__avatar").some(
        (element) => element.tagName === "img"
      )
    );

    const preflightStageButtons = environment.app.querySelectorAll("[data-forge-action='open-stage']");
    const preflightPreviousButton = preflightStageButtons.find(
      (element) => element.dataset["forgeActionValue"] === "operator"
    );
    assert.ok(preflightPreviousButton);
    assert.equal(preflightPreviousButton.disabled, false);

    const runConditionComposerButton = environment.app.querySelector(
      "[data-forge-action='toggle-run-condition-composer']"
    ) as FakeElement | null;
    assert.ok(runConditionComposerButton);
    fireEvent(runConditionComposerButton, "click");
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
        notes: "",
        temporaryConditions: ["Protect nearby plastic"],
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
        temporaryConditions: [],
      },
    });
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomUpdateRunOverride",
      result: {
        success: true,
        message: null,
      },
    });

    fireEvent(preflightPreviousButton, "click");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomSaveSession",
      result: {
        success: true,
        message: null,
      },
    });
    assert.ok(environment.app.querySelector("[data-forge-active-stage='operator']"));

    const multimeterSelection = environment.app
      .querySelectorAll("[data-forge-context-chip]")
      .find((element) => element.dataset["forgeContextKey"] === "multimeter");
    assert.ok(multimeterSelection);
    fireEvent(multimeterSelection, "click");
    assert.ok(environment.sentCommands.includes("ForgeRoomUpdateSessionContext"));
    const measurementSelection = environment.app
      .querySelectorAll("[data-forge-context-chip]")
      .find((element) => element.dataset["forgeContextKey"] === "measurement");
    assert.ok(measurementSelection);
    fireEvent(measurementSelection, "click");
    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomUpdateSessionContext",
      payload: {
        skillKeys: ["measurement"],
        equipmentKeys: ["multimeter"],
        preferenceKeys: [],
      },
    });
    assert.match(readTreeText(environment.app), /Multimeter/);

    const operatorToPreflightButtons = environment.app.querySelectorAll(
      "[data-forge-action='open-stage']"
    );
    const operatorToPreflightButton = operatorToPreflightButtons.find(
      (element) => element.dataset["forgeActionValue"] === "preflight"
    );
    assert.ok(operatorToPreflightButton);
    fireEvent(operatorToPreflightButton, "click");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomSaveSession",
      result: {
        success: true,
        message: null,
      },
    });

    const preflightToTrackingButtons = environment.app.querySelectorAll(
      "[data-forge-action='open-stage']"
    );
    const trackingNextButton = preflightToTrackingButtons.find(
      (element) => element.dataset["forgeActionValue"] === "tracking"
    );
    assert.ok(trackingNextButton);
    fireEvent(trackingNextButton, "click");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomSaveSession",
      result: {
        success: true,
        message: null,
      },
    });

    const trackingToDraftButtons = environment.app.querySelectorAll(
      "[data-forge-action='open-stage']"
    );
    const draftNextButton = trackingToDraftButtons.find(
      (element) => element.dataset["forgeActionValue"] === "draft"
    );
    assert.ok(draftNextButton);
    fireEvent(draftNextButton, "click");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomSaveSession",
      result: {
        success: true,
        message: null,
      },
    });
    assert.ok(environment.app.querySelector("[data-forge-active-stage='draft']"));
    assert.ok(environment.app.querySelector("[data-forge-panel='approved']"));
    assert.ok(environment.app.querySelector("#forge-approved-mode-forge-task-approved-1"));
    assert.equal(
      environment.app.querySelector("#forge-approved-capsule-summary-forge-task-approved-1"),
      null
    );
    assert.match(readTreeText(environment.app), /Advanced capsule/);

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

    const conflictButtons = findElementsByClass(environment.app, "forge-statusbar__action");
    assert.equal(conflictButtons.length, 0);

    const conflictText = readTreeText(environment.app);
    assert.match(conflictText, /State Conflict/);
    assert.match(conflictText, /RESPONSE LANE BLOCKED/);
    assert.match(conflictText, /REQUIRES: CONFLICT RESOLUTION/);
    assert.match(conflictText, /SELECT ONE RESPONSE/);
    assert.match(conflictText, /OUTPUT GATE BLOCKED/);
    assert.doesNotMatch(conflictText, /Required action/);
  } finally {
    await installedCopy.cleanup();
    environment.restore();
  }
});

test("forge-room session context empty states route operator profile entry through the top bar", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("forge-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?smoke=${Date.now()}-empty-context`
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
      assistant: {
        nickname: "Hayalet",
        avatar: "/avatars/ai0.png",
        connected: true,
      },
      user: {
        nickname: "Operator",
      },
    });

    environment.emitHostMessage({
      type: "forge-state",
      snapshot: {
        activeSessionId: "forge-session-empty",
        currentGoal: {
          id: "forge-goal-empty",
          summary: "Prepare the empty operator state",
          brief: "Route the operator setup through the top bar only.",
          constraints: ["Keep the session context empty."],
          acceptanceCriteria: [],
          status: "draft",
          targetRoomId: "repair-room",
          createdAt: "2026-04-17T00:00:00.000Z",
          updatedAt: "2026-04-17T00:00:00.000Z",
        },
        draftTasks: [],
        draftSourceText: null,
        validationMessages: [],
        decisionTrace: [],
        approvedTasks: [],
        assignments: [],
        responses: [],
        conflicts: [],
        syntheses: [],
        selectedSynthesisId: null,
        operatorProfile: {
          schemaVersion: 2,
          updatedAt: "2026-04-17T00:00:00.000Z",
          skills: [],
          equipment: [],
          preferences: {},
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
        sessionContextSelection: {
          skillKeys: [],
          equipmentKeys: [],
          preferenceKeys: [],
        },
        runOverride: null,
        runSignature: null,
        exports: [],
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
          note: "Waiting for the first goal draft.",
          lastUpdatedAt: "2026-04-17T00:00:00.000Z",
        },
        sessionList: [],
      },
      meta: {
        roleCatalog: {},
        personaPresets: {},
      },
    });
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomCreateSession",
      result: {
        success: true,
        message: null,
      },
    });

    const profileActions = environment.app.querySelectorAll(
      "[data-forge-action='toggle-profile-editor']"
    );
    assert.equal(profileActions.length, 1);
    const sessionNextButton = environment.app
      .querySelectorAll("[data-forge-action='open-stage']")
      .find((element) => element.dataset["forgeActionValue"] === "operator");
    assert.ok(sessionNextButton);
    fireEvent(sessionNextButton, "click");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomUpdateGoal",
      result: {
        success: true,
        message: null,
      },
    });
    assert.ok(environment.app.querySelector("[data-forge-active-stage='operator']"));
    assert.equal(
      environment.app.querySelectorAll("[data-forge-action='toggle-profile-editor']").length,
      1
    );
    assert.match(readTreeText(environment.app), /No saved skills/);
    assert.match(readTreeText(environment.app), /No saved equipment/);
    assert.match(readTreeText(environment.app), /Operator Profile from the top bar/);
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
      assistant: {
        nickname: "Hayalet",
        avatar: "/avatars/ai0.png",
        connected: true,
      },
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
          brief: "Operator baglamini topbar odakli birak.",
          constraints: ["Session alani sade kalsin."],
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
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomCreateSession",
      result: {
        success: true,
        message: null,
      },
    });

    const uiText = readTreeText(environment.app);
    assert.match(uiText, /Operatör Profili/);
    assert.match(uiText, /Oturum \+ Hedef/);
    assert.match(uiText, /Kayıtlı oturumlar/);
    assert.match(uiText, /Ön kontrol/);
    assert.match(uiText, /Önceki/);
    assert.match(uiText, /Sonraki/);
    assert.doesNotMatch(uiText, /Gerekli adım/);
    assert.doesNotMatch(uiText, /Aktif oturum bağlandı/);
    assert.doesNotMatch(uiText, /Taslak öncesi ön kontrol çalıştır/);

    const sessionNextButton = environment.app
      .querySelectorAll("[data-forge-action='open-stage']")
      .find((element) => element.dataset["forgeActionValue"] === "operator");
    assert.ok(sessionNextButton);
    fireEvent(sessionNextButton, "click");
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomUpdateGoal",
      result: {
        success: true,
        message: null,
      },
    });
    const operatorText = readTreeText(environment.app);
    assert.doesNotMatch(operatorText, /BU RUN ICIN BAGLAM/);
    assert.match(operatorText, /Kayıtlı yetenek yok/);
    assert.match(operatorText, /Kayıtlı ekipman yok/);
    assert.match(operatorText, /Mod/);
    assert.match(operatorText, /Risk toleransı/);
  } finally {
    await installedCopy.cleanup();
    environment.restore();
  }
});

test("forge-room enables session advance only after all combined goal fields are filled", async () => {
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
      assistant: {
        nickname: "Hayalet",
        avatar: "/avatars/ai0.png",
        connected: true,
      },
      user: {
        nickname: "Operator",
      },
    });

    environment.emitHostMessage({
      type: "forge-state",
      snapshot: {
        activeSessionId: null,
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

    assert.deepEqual(environment.sentEvents.at(-1), {
      command: "ForgeRoomCreateSession",
      payload: {
        persist: false,
      },
    });

    environment.emitHostMessage({
      type: "forge-state",
      snapshot: {
        activeSessionId: "forge-session-draft",
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
    environment.emitHostMessage({
      type: "command-result",
      command: "ForgeRoomCreateSession",
      result: {
        success: true,
        message: null,
      },
    });

    let nextButton = environment.app
      .querySelectorAll("[data-forge-action='open-stage']")
      .find((element) => element.dataset["forgeActionValue"] === "operator");
    assert.ok(nextButton);
    assert.equal(nextButton.disabled, true);

    const goalSummaryInput = environment.app.querySelector("#forge-goal-summary") as FakeElement | null;
    assert.ok(goalSummaryInput);
    goalSummaryInput.value = "Repair Room integration";
    fireEvent(goalSummaryInput, "input");
    assert.equal(environment.app.querySelector("#forge-goal-summary"), goalSummaryInput);
    nextButton = environment.app
      .querySelectorAll("[data-forge-action='open-stage']")
      .find((element) => element.dataset["forgeActionValue"] === "operator");
    assert.ok(nextButton);
    assert.equal(nextButton.disabled, true);

    const briefInput = environment.app.querySelector("#forge-goal-brief") as FakeElement | null;
    assert.ok(briefInput);
    briefInput.value = "Document the repair boundary.";
    fireEvent(briefInput, "input");
    nextButton = environment.app
      .querySelectorAll("[data-forge-action='open-stage']")
      .find((element) => element.dataset["forgeActionValue"] === "operator");
    assert.ok(nextButton);
    assert.equal(nextButton.disabled, true);

    const constraintsInput = environment.app.querySelector(
      "#forge-goal-constraints"
    ) as FakeElement | null;
    assert.ok(constraintsInput);
    constraintsInput.value = "Keep the scope local.\nPreserve host logic.";
    fireEvent(constraintsInput, "input");
    assert.equal(environment.app.querySelector("#forge-goal-constraints"), constraintsInput);
    nextButton = environment.app
      .querySelectorAll("[data-forge-action='open-stage']")
      .find((element) => element.dataset["forgeActionValue"] === "operator");
    assert.ok(nextButton);
    assert.equal(nextButton.disabled, true);

    const targetRoomInput = environment.app.querySelector(
      "#forge-goal-target-room"
    ) as FakeElement | null;
    assert.ok(targetRoomInput);
    targetRoomInput.value = "repair-room";
    fireEvent(targetRoomInput, "input");
    nextButton = environment.app
      .querySelectorAll("[data-forge-action='open-stage']")
      .find((element) => element.dataset["forgeActionValue"] === "operator");
    assert.ok(nextButton);
    assert.equal(nextButton.disabled, false);

    fireEvent(nextButton, "click");

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
