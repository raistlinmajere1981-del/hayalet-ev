import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];
type LaboratoryManualGuidePlatform = "linux" | "windows";

type LaboratoryJobRecord = LaboratoryRecord & {
  action?: unknown;
  stage?: unknown;
  toolId?: unknown;
};

type LaboratoryToolDetailsRecord = LaboratoryRecord & {
  availability?: unknown;
  platformSupported?: unknown;
};

type LaboratoryToolStateRecord = LaboratoryRecord & {
  binaryPath?: unknown;
  busy?: unknown;
  details?: unknown;
  installed?: unknown;
  latestReleaseName?: unknown;
  latestVersion?: unknown;
  updateAvailable?: unknown;
  version?: unknown;
};

type LaboratoryManualGuidePlatformRecord = LaboratoryRecord & {
  installCommands?: unknown;
};

type LaboratoryToolDescriptorRecord = LaboratoryRecord & {
  availability?: unknown;
  displayName?: unknown;
  installerType?: unknown;
  installStrategy?: unknown;
  manualGuide?: unknown;
  manualHint?: unknown;
  plannedReason?: unknown;
  setupHint?: unknown;
  systemCommand?: unknown;
  toolId?: unknown;
};

type LaboratorySettingsToolCardRuntimeDeps = {
  escapeHtml: (value: string) => string;
  getToolEntry: (toolId: string) => LaboratoryToolStateRecord;
  getToolRegistry: () => LaboratoryToolDescriptorRecord[];
  renderPreviewMetaRow: (label: string, value: unknown) => string;
  state: LaboratoryUiState;
  text: (path: string[]) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySettingsToolCardRuntime(
  deps: LaboratorySettingsToolCardRuntimeDeps
) {
  const { escapeHtml, getToolEntry, getToolRegistry, renderPreviewMetaRow, state, text, toRecord } =
    deps;

  function toToolStateRecord(value: unknown): LaboratoryToolStateRecord {
    return toRecord(value);
  }

  function toToolDetailsRecord(value: unknown): LaboratoryToolDetailsRecord {
    return toRecord(value);
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return toString(entry).trim();
      })
      .filter(function (entry) {
        return entry !== "";
      });
  }

  function getDescriptor(toolId: string): LaboratoryToolDescriptorRecord | null {
    return (
      getToolRegistry().find(function (entry) {
        return toString(entry.toolId).trim() === toolId;
      }) || null
    );
  }

  function getDisplayName(
    toolId: string,
    descriptor: LaboratoryToolDescriptorRecord | null
  ): string {
    return (
      text(["mediaAnalysis", "settings", "tools", toolId]) ||
      toString(descriptor?.displayName) ||
      toolId
    );
  }

  function getAvailability(
    details: LaboratoryToolDetailsRecord,
    descriptor: LaboratoryToolDescriptorRecord | null
  ): string {
    return (
      toString(details.availability).trim() ||
      toString(descriptor?.availability).trim() ||
      "installable"
    );
  }

  function normalizeHelperPlatform(value: unknown): LaboratoryManualGuidePlatform {
    return value === "windows" ? "windows" : "linux";
  }

  function getManualGuidePlatformRecord(
    descriptor: LaboratoryToolDescriptorRecord | null,
    platform: LaboratoryManualGuidePlatform
  ): LaboratoryManualGuidePlatformRecord {
    const manualGuide = toRecord(descriptor?.manualGuide);
    return toRecord(manualGuide[platform]);
  }

  function getInstallCommands(
    descriptor: LaboratoryToolDescriptorRecord | null,
    platform: LaboratoryManualGuidePlatform
  ): string[] {
    return toStringArray(getManualGuidePlatformRecord(descriptor, platform).installCommands);
  }

  function toJobRecord(value: unknown): LaboratoryJobRecord {
    return toRecord(value);
  }

  function isFinalJobStage(stage: string): boolean {
    return ["completed", "failed", "cancelled"].includes(stage);
  }

  function isToolAction(action: string): boolean {
    return action.startsWith("tool-");
  }

  function hasRunningToolJob(toolId: string): boolean {
    const jobs = Array.isArray(state.sourceSnapshot.jobs) ? state.sourceSnapshot.jobs : [];
    return jobs.map(toJobRecord).some(function (job) {
      const action = toString(job.action).trim();
      const stage = toString(job.stage).trim();
      const jobToolId = toString(job.toolId).trim();
      if (isToolAction(action) !== true || isFinalJobStage(stage)) {
        return false;
      }
      return jobToolId === "" || jobToolId === toolId;
    });
  }

  function hasHelper(descriptor: LaboratoryToolDescriptorRecord | null): boolean {
    return (
      getInstallCommands(descriptor, "linux").length > 0 ||
      getInstallCommands(descriptor, "windows").length > 0
    );
  }

  function isHelperOpen(toolId: string): boolean {
    return state.ui.settingsHelperToolId === toolId;
  }

  function renderPlatformButtons(toolId: string, activePlatform: LaboratoryManualGuidePlatform) {
    return (
      [
        ["linux", text(["mediaAnalysis", "settings", "helper", "platforms", "linux"])],
        ["windows", text(["mediaAnalysis", "settings", "helper", "platforms", "windows"])],
      ] as Array<[LaboratoryManualGuidePlatform, string]>
    )
      .map(function ([platformId, label]) {
        return `
          <button
            class="lab-button lab-button--ghost lab-button--tight lab-tool-helper__platform-button"
            type="button"
            data-action="tool-helper-platform"
            data-value="${toolId}::${platformId}"
            data-selected="${activePlatform === platformId ? "true" : "false"}"
          >
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join("");
  }

  function renderInstallCommand(
    toolId: string,
    platform: LaboratoryManualGuidePlatform,
    command: string,
    index: number
  ) {
    return `
      <div class="lab-tool-helper__command">
        <code>${escapeHtml(command)}</code>
        <button
          class="lab-button lab-button--ghost lab-button--tight"
          type="button"
          data-action="tool-helper-copy-install"
          data-value="${toolId}::${platform}::${index}"
        >
          ${escapeHtml(text(["mediaAnalysis", "settings", "helper", "copyCommandAction"]))}
        </button>
      </div>
    `;
  }

  function renderManualHelper(toolId: string, descriptor: LaboratoryToolDescriptorRecord | null) {
    if (!isHelperOpen(toolId)) {
      return "";
    }

    const activePlatform = normalizeHelperPlatform(state.ui.settingsHelperPlatform);
    const installCommands = getInstallCommands(descriptor, activePlatform);

    return `
      <section class="lab-tool-helper">
        <div class="lab-tool-helper__platforms">
          ${renderPlatformButtons(toolId, activePlatform)}
        </div>
        ${
          installCommands.length > 0
            ? installCommands
                .map(function (command, index) {
                  return renderInstallCommand(toolId, activePlatform, command, index);
                })
                .join("")
            : `<p class="lab-panel__hint">${escapeHtml(
                text(["mediaAnalysis", "settings", "helper", "commandsEmpty"])
              )}</p>`
        }
      </section>
    `;
  }

  function renderToolCard(toolId: string) {
    const tool = toToolStateRecord(getToolEntry(toolId));
    const descriptor = getDescriptor(toolId);
    const details = toToolDetailsRecord(tool.details);
    const busy = tool.busy === true || hasRunningToolJob(toolId);
    const installed = tool.installed === true;
    const updateAvailable = tool.updateAvailable === true;
    const availability = getAvailability(details, descriptor);
    const installStrategy = toString(descriptor?.installStrategy, "--");
    const installerType = toString(descriptor?.installerType).trim();
    const managedInstaller = installStrategy === "automatic" || installerType !== "";
    const platformSupported = details.platformSupported !== false;
    const helperOpen = isHelperOpen(toolId);
    const helperAvailable = hasHelper(descriptor);
    const plannedReason = toString(descriptor?.plannedReason).trim();

    const statusLabel =
      availability === "planned"
        ? text(["mediaAnalysis", "settings", "status", "planned"])
        : installed
          ? updateAvailable
            ? text(["mediaAnalysis", "settings", "status", "updateAvailable"])
            : text(["mediaAnalysis", "settings", "status", "installed"])
          : platformSupported !== true
            ? text(["mediaAnalysis", "settings", "support", "unsupported"])
            : managedInstaller
              ? text(["mediaAnalysis", "settings", "status", "appInstall"])
              : text(["mediaAnalysis", "settings", "status", "manualSetup"]);

    const primaryActions: string[] = [];
    const secondaryActions: string[] = [];

    if (availability === "planned") {
      primaryActions.push(`
        <button class="lab-button lab-button--ghost lab-button--tight" type="button" disabled>
          ${escapeHtml(text(["mediaAnalysis", "settings", "status", "planned"]))}
        </button>
      `);
    } else if (installed) {
      primaryActions.push(`
        <button
          class="lab-button lab-button--ghost lab-button--tight"
          type="button"
          data-action="tool-check-updates"
          data-value="${toolId}"
          ${busy ? "disabled" : ""}
        >
          ${escapeHtml(text(["mediaAnalysis", "settings", "checkUpdatesAction"]))}
        </button>
      `);
      if (updateAvailable) {
        primaryActions.push(`
          <button
            class="lab-button lab-button--primary lab-button--tight"
            type="button"
            data-action="tool-update"
            data-value="${toolId}"
            ${busy ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "settings", "updateAction"]))}
          </button>
        `);
      }
      if (helperAvailable) {
        secondaryActions.push(`
          <button class="lab-button lab-button--ghost lab-button--tight" type="button" disabled>
            ${escapeHtml(text(["mediaAnalysis", "settings", "helper", "toggleAction"]))}
          </button>
        `);
      }
    } else if (platformSupported !== true) {
      primaryActions.push(`
        <button class="lab-button lab-button--ghost lab-button--tight" type="button" disabled>
          ${escapeHtml(text(["mediaAnalysis", "settings", "support", "unsupported"]))}
        </button>
      `);
    } else {
      if (managedInstaller) {
        primaryActions.push(`
          <button
            class="lab-button lab-button--primary lab-button--tight"
            type="button"
            data-action="tool-install"
            data-value="${toolId}"
            ${busy ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "settings", "installAction"]))}
          </button>
        `);
      }

      if (helperAvailable) {
        secondaryActions.push(`
          <button
            class="lab-button ${managedInstaller ? "lab-button--ghost" : "lab-button--primary"} lab-button--tight"
            type="button"
            data-action="tool-helper-toggle"
            data-value="${toolId}"
            aria-expanded="${helperOpen ? "true" : "false"}"
            ${busy ? "disabled" : ""}
          >
            ${escapeHtml(
              text([
                "mediaAnalysis",
                "settings",
                "helper",
                helperOpen ? "collapseAction" : "toggleAction",
              ])
            )}
          </button>
        `);
      }
    }

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(getDisplayName(toolId, descriptor))}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          <div class="lab-tool-card__actions">
            ${primaryActions.join("")}
            ${secondaryActions.join("")}
          </div>
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "versionLabel"]),
            toString(tool.version, "--")
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "latestLabel"]),
            toString(tool.latestVersion) || toString(tool.latestReleaseName) || "--"
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "pathLabel"]),
            toString(tool.binaryPath, "--")
          )}
          ${renderPreviewMetaRow(text(["workbench", "dependency", "strategy"]), installStrategy)}
        </ul>
        ${
          busy
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "settings", "busyHint"]))}</p>`
            : ""
        }
        ${
          installed && updateAvailable
            ? `<p class="lab-panel__hint">${escapeHtml(
                text(["mediaAnalysis", "settings", "updateAvailableHint"])
              )}</p>`
            : ""
        }
        ${
          !installed && plannedReason !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(plannedReason)}</p>`
            : ""
        }
        ${!installed && helperOpen ? renderManualHelper(toolId, descriptor) : ""}
      </article>
    `;
  }

  return {
    renderToolCard,
  };
}
