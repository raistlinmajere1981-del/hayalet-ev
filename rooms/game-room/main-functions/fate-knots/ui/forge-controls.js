/* global window, document */

(function (global) {
  const ui = global.GameRoomFateKnotsUi;
  if (!ui || typeof ui.render !== "function") return;

  const CREATE_COMMAND = "GameRoomFateKnotsCreateUniverse";
  const CAPABILITIES_COMMAND = "GameRoomFateKnotsGetForgeCapabilities";
  const forgeState = {
    open: false,
    requestedCapabilities: false,
    capabilities: null,
    authoringProvider: "ai1",
    assetProvider: "ai1",
    brief: "",
    status: "",
  };

  const baseRender = ui.render.bind(ui);
  const baseHandleCommandResult =
    typeof ui.handleCommandResult === "function" ? ui.handleCommandResult.bind(ui) : null;

  function readRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function readArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readString(value) {
    return typeof value === "string" ? value : "";
  }

  function sendCommand(name, payload) {
    const roomApi = global.roomAPI;
    return Boolean(
      roomApi && typeof roomApi.sendCommand === "function" && roomApi.sendCommand(name, payload || {})
    );
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root) ui.render(root);
  }

  function providerAvailable(kind, provider) {
    const capabilities = readRecord(forgeState.capabilities);
    const entries = capabilities ? readArray(capabilities[kind]) : [];
    const entry = entries.find(function (candidate) {
      const record = readRecord(candidate);
      return record && record.provider === provider;
    });
    const record = readRecord(entry);
    return Boolean(record && record.available === true);
  }

  function syncSelectionsFromCapabilities() {
    if (!providerAvailable("authoringProviders", forgeState.authoringProvider)) {
      const fallback = readArray(readRecord(forgeState.capabilities)?.authoringProviders).find(function (
        candidate
      ) {
        return readRecord(candidate)?.available === true;
      });
      forgeState.authoringProvider = readString(readRecord(fallback)?.provider) || "ai1";
    }
    if (!providerAvailable("assetProviders", forgeState.assetProvider)) {
      const fallback = readArray(readRecord(forgeState.capabilities)?.assetProviders).find(function (
        candidate
      ) {
        return readRecord(candidate)?.available === true;
      });
      forgeState.assetProvider = readString(readRecord(fallback)?.provider) || "ai1";
    }
  }

  function requestCapabilities(force) {
    if (forgeState.requestedCapabilities) return;
    if (forgeState.capabilities && force !== true) return;
    forgeState.requestedCapabilities = true;
    if (!sendCommand(CAPABILITIES_COMMAND, {})) {
      forgeState.requestedCapabilities = false;
      forgeState.status = "World Forge hazırlık bilgisi alınamadı.";
    }
  }

  function makeProviderSelect(kind, selectedProvider) {
    const select = document.createElement("select");
    select.className = "fate-knots-hub__button";
    const providerIds = kind === "authoringProviders" ? ["ai1", "ai2"] : ["ai1", "ai0-local"];
    providerIds.forEach(function (provider) {
      const option = document.createElement("option");
      option.value = provider;
      option.textContent = provider === "ai0-local" ? "AI0 Local" : provider.toUpperCase();
      option.disabled = !providerAvailable(kind, provider);
      option.selected = provider === selectedProvider;
      select.append(option);
    });
    return select;
  }

  function formatAi0ImageStatus() {
    const capabilities = readRecord(forgeState.capabilities);
    if (!capabilities) {
      return forgeState.requestedCapabilities ? "AI0 Local yeteneği kontrol ediliyor…" : "";
    }
    const status = readRecord(capabilities.ai0ImageStatus);
    if (!status) return "AI0 Local durum bilgisi alınamadı.";

    const model = readString(status.activeModelKey) || "AI0 modeli seçilmedi";
    const skillNames = readArray(status.imageSkillNames)
      .map(readString)
      .filter(Boolean);
    const skillText =
      skillNames.length > 0 ? ` · skill: ${skillNames.join(", ")}` : " · image skill yok";
    if (status.available === true) {
      const toolId = readString(status.toolId) || "image_generate";
      return `AI0 Local hazır · model: ${model}${skillText} · tool: ${toolId}`;
    }
    const reason = readString(status.reason) || "uyumlu image generation tool bulunamadı";
    return `AI0 Local kapalı · model: ${model}${skillText} · ${reason}`;
  }

  function injectForgeControls(root) {
    const shell = root.querySelector(".fate-knots-hub");
    const headerActions = root.querySelector(
      ".fate-knots-hub__header > .fate-knots-hub__actions"
    );
    if (!shell || !headerActions) return;

    const legacyButton = Array.from(headerActions.querySelectorAll("button")).find(function (button) {
      return button.textContent === "Yeni Evren";
    });
    if (legacyButton) {
      legacyButton.disabled = false;
      legacyButton.title = "World Forge ile yeni evren oluştur";
      legacyButton.onclick = function () {
        forgeState.open = !forgeState.open;
        forgeState.status = "";
        if (forgeState.open) {
          forgeState.capabilities = null;
          requestCapabilities(true);
        }
        renderCurrent();
      };
    }

    if (!forgeState.open) return;
    requestCapabilities(false);

    const panel = document.createElement("section");
    panel.className = "fate-knots-hub__universe fate-knots-forge-controls";

    const title = document.createElement("h2");
    title.className = "fate-knots-hub__universe-title";
    title.textContent = "World Forge";
    panel.append(title);

    const authorRow = document.createElement("label");
    authorRow.textContent = "Evren yazarı ";
    const authorSelect = makeProviderSelect("authoringProviders", forgeState.authoringProvider);
    authorSelect.addEventListener("change", function () {
      forgeState.authoringProvider = authorSelect.value;
    });
    authorRow.append(authorSelect);
    panel.append(authorRow);

    const assetRow = document.createElement("label");
    assetRow.textContent = "Medya üretimi ";
    const assetSelect = makeProviderSelect("assetProviders", forgeState.assetProvider);
    assetSelect.addEventListener("change", function () {
      forgeState.assetProvider = assetSelect.value;
    });
    assetRow.append(assetSelect);
    panel.append(assetRow);

    const ai0StatusText = formatAi0ImageStatus();
    if (ai0StatusText) {
      const ai0Status = document.createElement("div");
      ai0Status.className = "fate-knots-hub__message";
      ai0Status.textContent = ai0StatusText;
      panel.append(ai0Status);
    }

    const brief = document.createElement("textarea");
    brief.rows = 4;
    brief.maxLength = 8000;
    brief.placeholder = "İsteğe bağlı evren fikri / kısa brief";
    brief.value = forgeState.brief;
    brief.addEventListener("input", function () {
      forgeState.brief = brief.value;
    });
    panel.append(brief);

    const capabilities = readRecord(forgeState.capabilities);
    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "fate-knots-hub__button";
    createButton.textContent = capabilities && capabilities.busy === true ? "Forge çalışıyor…" : "Oluştur";
    createButton.disabled = Boolean(
      !capabilities ||
        capabilities.busy === true ||
        capabilities.storageAvailable !== true ||
        !providerAvailable("authoringProviders", forgeState.authoringProvider) ||
        !providerAvailable("assetProviders", forgeState.assetProvider)
    );
    createButton.addEventListener("click", function () {
      forgeState.status = "World Forge başlatılıyor…";
      const sent = sendCommand(CREATE_COMMAND, {
        brief: forgeState.brief.trim() || null,
        executionPolicy: {
          authoringProvider: forgeState.authoringProvider,
          assetProvider: forgeState.assetProvider,
        },
      });
      if (!sent) forgeState.status = "World Forge komutu gönderilemedi.";
      renderCurrent();
    });
    panel.append(createButton);

    if (forgeState.status) {
      const status = document.createElement("div");
      status.className = "fate-knots-hub__message";
      status.textContent = forgeState.status;
      panel.append(status);
    }

    shell.insertBefore(panel, shell.children[1] || null);
  }

  ui.render = function renderWithForgeControls(root) {
    baseRender(root);
    injectForgeControls(root);
  };

  ui.handleCommandResult = function handleForgeCommandResult(message) {
    const record = readRecord(message);
    const command = readString(record?.command);
    const result = readRecord(record?.result) || {};

    if (command === CAPABILITIES_COMMAND) {
      forgeState.requestedCapabilities = false;
      if (result.ok === true) {
        forgeState.capabilities = result;
        syncSelectionsFromCapabilities();
        forgeState.status = "";
      } else {
        forgeState.status = "World Forge hazırlık bilgisi alınamadı.";
      }
      return true;
    }

    if (command === CREATE_COMMAND) {
      forgeState.capabilities = readRecord(result.capabilities) || forgeState.capabilities;
      forgeState.requestedCapabilities = false;
      if (result.ok === true) {
        forgeState.open = false;
        forgeState.brief = "";
        forgeState.status = "";
        sendCommand("GameRoomFateKnotsGetHubState", {});
      } else {
        const messageText = readString(result.message);
        forgeState.status = messageText || "World Forge tamamlanamadı.";
      }
      return true;
    }

    return baseHandleCommandResult ? baseHandleCommandResult(message) : false;
  };
})(window);
