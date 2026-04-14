export function createLaboratorySettingsToolCardRuntime(deps) {
  const { escapeHtml, getToolEntry, getToolRegistry, renderPreviewMetaRow, state, text, toRecord } = deps;
  function toToolStateRecord(value) {
    return toRecord(value);
  }
  function toToolDetailsRecord(value) {
    return toRecord(value);
  }
  function toString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return toString(entry).trim();
    }).filter(function(entry) {
      return entry !== "";
    });
  }
  function getDescriptor(toolId) {
    return getToolRegistry().find(function(entry) {
      return toString(entry.toolId) === toolId;
    }) || null;
  }
  function getAvailability(details, descriptor) {
    return toString(details.availability).trim() || toString(descriptor?.availability).trim() || "installable";
  }
  function readStageSupport(descriptor, stageId) {
    const stageSupport = toRecord(descriptor?.stageSupport);
    return toString(stageSupport[stageId], "unsupported");
  }
  function normalizeHelperPlatform(value) {
    if (value === "macos" || value === "windows") {
      return value;
    }
    return "linux";
  }
  function getManualGuidePlatformRecord(descriptor, platform) {
    const manualGuide = toRecord(descriptor?.manualGuide);
    return toRecord(manualGuide[platform]);
  }
  function getInstallCommands(descriptor, platform) {
    return toStringArray(getManualGuidePlatformRecord(descriptor, platform).installCommands);
  }
  function getGuideNotes(descriptor, platform) {
    return toStringArray(getManualGuidePlatformRecord(descriptor, platform).notes);
  }
  function getDisplayName(toolId, descriptor) {
    return text(["mediaAnalysis", "settings", "tools", toolId]) || toString(descriptor?.displayName) || toolId;
  }
  function isHelperOpen(toolId) {
    return state.ui.settingsHelperToolId === toolId;
  }
  function renderPlatformButtons(toolId, activePlatform) {
    return [
      ["linux", text(["mediaAnalysis", "settings", "helper", "platforms", "linux"])],
      ["macos", text(["mediaAnalysis", "settings", "helper", "platforms", "macos"])],
      ["windows", text(["mediaAnalysis", "settings", "helper", "platforms", "windows"])]
    ].map(function([platformId, label]) {
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
    }).join("");
  }
  function renderInstallCommand(toolId, platform, command, index) {
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
  function renderHelperTags(values) {
    if (values.length === 0) {
      return "";
    }
    return `
      <div class="lab-tool-helper__tags">
        ${values.map(function(value) {
      return `<span class="lab-tool-helper__tag">${escapeHtml(value)}</span>`;
    }).join("")}
      </div>
    `;
  }
  function renderManualHelper(toolId, tool, descriptor, setupHint) {
    if (!isHelperOpen(toolId)) {
      return "";
    }
    const activePlatform = normalizeHelperPlatform(state.ui.settingsHelperPlatform);
    const installCommands = getInstallCommands(descriptor, activePlatform);
    const notes = getGuideNotes(descriptor, activePlatform);
    const commandName = toString(descriptor?.commandName, "--");
    const envVarNames = toStringArray(descriptor?.envVarNames);
    const managedInstaller = toString(descriptor?.installerType).trim() !== "";
    const usedBy = Array.isArray(descriptor?.usedBy) ? descriptor.usedBy.map(function(entry) {
      return String(entry);
    }) : [];
    const testImpact = Array.isArray(descriptor?.testImpact) ? descriptor.testImpact.map(function(entry) {
      return String(entry);
    }) : [];
    const readinessImpact = toString(descriptor?.readinessImpact).trim();
    const nextActionLabel = managedInstaller ? tool.installed === true ? text(["mediaAnalysis", "settings", "updateAction"]) : text(["mediaAnalysis", "settings", "installAction"]) : tool.installed === true ? text(["mediaAnalysis", "settings", "manualRefreshAction"]) : text(["mediaAnalysis", "settings", "manualCheckAction"]);
    const nextActionId = managedInstaller || tool.installed === true ? tool.installed === true ? "tool-update" : "tool-install" : "tool-install";
    const diagnosisClass = tool.installed === true ? "lab-tool-helper__diagnosis lab-tool-helper__diagnosis--ready" : toString(tool.binaryPath).trim() !== "" || toString(tool.lastError).trim() !== "" ? "lab-tool-helper__diagnosis lab-tool-helper__diagnosis--warning" : "lab-tool-helper__diagnosis lab-tool-helper__diagnosis--danger";
    const diagnosisText = tool.installed === true ? text(["mediaAnalysis", "settings", "helper", "diagnosisReady"]) : toString(tool.binaryPath).trim() !== "" ? text(["mediaAnalysis", "settings", "helper", "diagnosisProbeFailed"]) : text(["mediaAnalysis", "settings", "helper", "diagnosisMissing"]);
    return `
      <section class="lab-tool-helper">
        <div class="${diagnosisClass}">
          <span class="lab-tool-helper__eyebrow">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "title"])
    )}</span>
          <strong>${escapeHtml(text(["mediaAnalysis", "settings", "helper", "diagnosisLabel"]))}</strong>
          <p>${escapeHtml(diagnosisText)}</p>
          ${managedInstaller ? `<p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "appInstallHint"])
    )}</p>` : ""}
          ${toString(tool.lastError).trim() !== "" ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(
      toString(tool.lastError)
    )}</p>` : ""}
        </div>
        <div class="lab-tool-helper__meta-grid">
          <section class="lab-tool-helper__meta-card">
            <span>${escapeHtml(text(["mediaAnalysis", "settings", "helper", "hostLabel"]))}</span>
            <strong>${escapeHtml(commandName)}</strong>
            <p class="lab-panel__hint">
              ${escapeHtml(text(["mediaAnalysis", "settings", "helper", "expectedCommandLabel"]))}
            </p>
            ${envVarNames.length > 0 ? `
                  <p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "envOverrideLabel"])
    )}</p>
                  ${renderHelperTags(envVarNames)}
                ` : ""}
          </section>
          <section class="lab-tool-helper__meta-card">
            <span>${escapeHtml(text(["mediaAnalysis", "settings", "helper", "unlockLabel"]))}</span>
            <strong>${escapeHtml(
      readinessImpact || text(["mediaAnalysis", "settings", "helper", "unlockFallback"])
    )}</strong>
            ${usedBy.length > 0 ? `<p class="lab-panel__hint">${escapeHtml(
      `${text(["workbench", "dependency", "usedBy"])}: ${usedBy.join(", ")}`
    )}</p>` : ""}
          </section>
        </div>
        <section class="lab-tool-helper__section">
          <div class="lab-tool-helper__section-head">
            <div>
              <strong>${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "commandsLabel"])
    )}</strong>
              <p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "commandsHint"])
    )}</p>
            </div>
            <div class="lab-tool-helper__platforms">
              ${renderPlatformButtons(toolId, activePlatform)}
            </div>
          </div>
          ${installCommands.length > 0 ? installCommands.map(function(command, index) {
      return renderInstallCommand(toolId, activePlatform, command, index);
    }).join("") : `<p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "commandsEmpty"])
    )}</p>`}
          ${notes.length > 0 ? `
                <div class="lab-tool-helper__notes">
                  <p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "notesLabel"])
    )}</p>
                  ${notes.map(function(note) {
      return `<p class="lab-panel__hint">${escapeHtml(note)}</p>`;
    }).join("")}
                </div>
              ` : ""}
          ${setupHint ? `
                <div class="lab-tool-helper__notes">
                  <p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "setupHintLabel"])
    )}</p>
                  <p class="lab-panel__hint">${escapeHtml(setupHint)}</p>
                </div>
              ` : ""}
          ${testImpact.length > 0 ? `<p class="lab-panel__hint">${escapeHtml(
      `${text(["workbench", "dependency", "tests"])}: ${testImpact.join(", ")}`
    )}</p>` : ""}
        </section>
        <section class="lab-tool-helper__next">
          <div>
            <strong>${escapeHtml(text(["mediaAnalysis", "settings", "helper", "nextStepLabel"]))}</strong>
            <p class="lab-panel__hint">${escapeHtml(
      text(["mediaAnalysis", "settings", "helper", "nextStepBody"])
    )}</p>
          </div>
          <button
            class="lab-button lab-button--ghost lab-button--tight"
            type="button"
            data-action="${nextActionId}"
            data-value="${toolId}"
          >
            ${escapeHtml(nextActionLabel)}
          </button>
        </section>
      </section>
    `;
  }
  function renderToolCard(toolId, stageId) {
    const tool = toToolStateRecord(getToolEntry(toolId));
    const descriptor = getDescriptor(toolId);
    const details = toToolDetailsRecord(tool.details);
    const busy = tool.busy === true;
    const updateAvailable = tool.updateAvailable === true;
    const availability = getAvailability(details, descriptor);
    const stageSupport = readStageSupport(descriptor, stageId);
    const planned = availability === "planned";
    const systemCommand = availability === "system-command";
    const managedInstaller = systemCommand && toString(descriptor?.installerType).trim() !== "";
    const helperOpen = systemCommand && isHelperOpen(toolId);
    const plannedReason = toString(details.plannedReason).trim() || toString(descriptor?.plannedReason).trim();
    const setupHint = toString(details.setupHint).trim() || toString(descriptor?.manualHint).trim() || toString(descriptor?.setupHint).trim();
    const installStrategy = toString(descriptor?.installStrategy, "--");
    const readinessImpact = toString(descriptor?.readinessImpact).trim();
    const usedBy = Array.isArray(descriptor?.usedBy) ? descriptor.usedBy.map(function(entry) {
      return String(entry);
    }) : [];
    const testImpact = Array.isArray(descriptor?.testImpact) ? descriptor.testImpact.map(function(entry) {
      return String(entry);
    }) : [];
    const statusLabel = planned ? text(["mediaAnalysis", "settings", "status", "planned"]) : systemCommand ? tool.installed === true ? text(["mediaAnalysis", "settings", "status", "manualReady"]) : managedInstaller ? text(["mediaAnalysis", "settings", "status", "appInstall"]) : text(["mediaAnalysis", "settings", "status", "manualSetup"]) : tool.installed === true ? updateAvailable ? text(["mediaAnalysis", "settings", "status", "updateAvailable"]) : text(["mediaAnalysis", "settings", "status", "installed"]) : text(["mediaAnalysis", "settings", "status", "missing"]);
    const helperToggleButtonMarkup = `
      <button
        class="lab-button lab-button--ghost lab-button--tight"
        type="button"
        data-action="tool-helper-toggle"
        data-value="${toolId}"
        aria-expanded="${helperOpen ? "true" : "false"}"
      >
        ${escapeHtml(
      text([
        "mediaAnalysis",
        "settings",
        "helper",
        helperOpen ? "collapseAction" : "toggleAction"
      ])
    )}
      </button>
    `;
    const manualProbeActionMarkup = `
      <button
        class="lab-button lab-button--ghost lab-button--tight"
        type="button"
        data-action="${tool.installed === true ? "tool-update" : "tool-install"}"
        data-value="${toolId}"
        ${busy ? "disabled" : ""}
      >
        ${escapeHtml(
      tool.installed === true ? text(["mediaAnalysis", "settings", "manualRefreshAction"]) : text(["mediaAnalysis", "settings", "manualCheckAction"])
    )}
      </button>
    `;
    const primaryActionMarkup = planned ? `
          <button
            class="lab-button lab-button--ghost lab-button--tight"
            type="button"
            disabled
          >
            ${escapeHtml(text(["mediaAnalysis", "settings", "status", "planned"]))}
          </button>
        ` : systemCommand ? managedInstaller ? `
            <button
              class="lab-button lab-button--${tool.installed === true ? "ghost" : "primary"} lab-button--tight"
              type="button"
              data-action="${tool.installed === true ? "tool-update" : "tool-install"}"
              data-value="${toolId}"
              ${busy ? "disabled" : ""}
            >
              ${escapeHtml(
      tool.installed === true ? text(["mediaAnalysis", "settings", "updateAction"]) : text(["mediaAnalysis", "settings", "installAction"])
    )}
            </button>
          ` : tool.installed === true ? manualProbeActionMarkup : helperToggleButtonMarkup.replace(
      "lab-button--ghost",
      helperOpen ? "lab-button--ghost" : "lab-button--primary"
    ) : tool.installed === true ? `
              <button
                class="lab-button lab-button--ghost lab-button--tight"
                type="button"
                data-action="tool-update"
                data-value="${toolId}"
                ${busy ? "disabled" : ""}
              >
                ${escapeHtml(text(["mediaAnalysis", "settings", "updateAction"]))}
              </button>
            ` : `
              <button
                class="lab-button lab-button--primary lab-button--tight"
                type="button"
                data-action="tool-install"
                data-value="${toolId}"
                ${busy ? "disabled" : ""}
              >
                ${escapeHtml(text(["mediaAnalysis", "settings", "installAction"]))}
              </button>
            `;
    const helperToggleMarkup = systemCommand ? managedInstaller || tool.installed === true ? helperToggleButtonMarkup : manualProbeActionMarkup : "";
    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(getDisplayName(toolId, descriptor))}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          <div class="lab-tool-card__actions">
            ${primaryActionMarkup}
            ${helperToggleMarkup}
          </div>
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
      text(["mediaAnalysis", "settings", "stageSupportLabel"]),
      text(["mediaAnalysis", "settings", "support", stageSupport])
    )}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "versionLabel"]), toString(tool.version, "--"))}
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
        ${busy ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "settings", "busyHint"]))}</p>` : ""}
        ${helperOpen ? renderManualHelper(toolId, tool, descriptor, setupHint) : ""}
        ${!helperOpen && usedBy.length > 0 ? `<p class="lab-panel__hint">${escapeHtml(
      `${text(["workbench", "dependency", "usedBy"])}: ${usedBy.join(", ")}`
    )}</p>` : ""}
        ${!helperOpen && testImpact.length > 0 ? `<p class="lab-panel__hint">${escapeHtml(
      `${text(["workbench", "dependency", "tests"])}: ${testImpact.join(", ")}`
    )}</p>` : ""}
        ${plannedReason ? `<p class="lab-panel__hint">${escapeHtml(plannedReason)}</p>` : ""}
        ${!helperOpen && readinessImpact ? `<p class="lab-panel__hint">${escapeHtml(readinessImpact)}</p>` : ""}
        ${!helperOpen && setupHint ? `<p class="lab-panel__hint">${escapeHtml(setupHint)}</p>` : ""}
        ${!helperOpen && toString(tool.lastError).trim() ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(
      toString(tool.lastError)
    )}</p>` : ""}
      </article>
    `;
  }
  return {
    renderToolCard
  };
}
