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
    submitting: false,
    authoringProvider: "ai1",
    assetProvider: "ai0-local",
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

  function unwrapCommandResult(value) {
    const result = readRecord(value) || {};
    return readRecord(result.data) || result;
  }

  function readString(value) {
    return typeof value === "string" ? value : "";
  }

  function sendCommand(name, payload) {
    const roomApi = global.roomAPI;
    return Boolean(
      roomApi &&
      typeof roomApi.sendCommand === "function" &&
      roomApi.sendCommand(name, payload || {})
    );
  }

  let progressTimer = null;
  function scheduleProgress() {
    if (progressTimer !== null || !(forgeState.submitting || forgeState.capabilities?.busy)) return;
    progressTimer = global.setTimeout(function () {
      progressTimer = null;
      if (!(forgeState.submitting || forgeState.capabilities?.busy)) return;
      requestCapabilities(true);
      scheduleProgress();
    }, 3500);
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root?.querySelector(".fate-knots-hub")) ui.render(root);
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
      const fallback = readArray(readRecord(forgeState.capabilities)?.authoringProviders).find(
        function (candidate) {
          return readRecord(candidate)?.available === true;
        }
      );
      forgeState.authoringProvider = readString(readRecord(fallback)?.provider) || "ai1";
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
    select.className = "fate-knots-forge__input";
    const providerIds = kind === "authoringProviders" ? ["ai1", "ai2"] : ["ai1", "ai0-local"];
    providerIds.forEach(function (provider) {
      const option = document.createElement("option");
      option.value = provider;
      option.textContent = provider === "ai0-local" ? "AI0" : provider.toUpperCase();
      option.disabled = !providerAvailable(kind, provider);
      option.selected = provider === selectedProvider;
      select.append(option);
    });
    select.disabled = forgeState.submitting || forgeState.capabilities?.busy === true;
    return select;
  }

  function readinessMessage() {
    const capabilities = forgeState.capabilities;
    if (forgeState.submitting || capabilities?.busy) {
      const progress = readRecord(capabilities?.progress);
      switch (progress?.stage) {
        case "authoring":
          return progress.message === "Evren taslağı doğrulama hataları düzeltiliyor…"
            ? progress.message
            : "Evren yazılıyor…";
        case "materializing":
          return "Evrenin görselleri hazırlanıyor…";
        case "finalizing":
          return "Evren doğrulanıyor…";
        case "saving":
          return "Evren arşive kaydediliyor…";
        default:
          return "Evren hazırlanıyor…";
      }
    }
    if (!capabilities)
      return forgeState.requestedCapabilities
        ? "Hazırlık kontrol ediliyor…"
        : "Hazırlık bilgisi alınamadı.";
    if (!capabilities.storageAvailable) return "Evren arşivine erişilemiyor.";
    if (capabilities.pending) {
      if (!providerAvailable("assetProviders", forgeState.assetProvider))
        return "Görsel üretimi hazır değil. Asistan bağlantısını kontrol edebilirsin.";
      return "Önceki taslak ve tamamlanan görseller korunuyor. Yalnız eksik işler üretilecek.";
    }
    if (!providerAvailable("authoringProviders", forgeState.authoringProvider))
      return "Evren yazarı için Asistan'da AI1 veya AI2 bağlantısı gerekli.";
    if (!providerAvailable("assetProviders", forgeState.assetProvider))
      return forgeState.assetProvider === "ai0-local"
        ? "AI0 görsel üretimi hazır değil. Asistan'daki görsel üretim durumunu kontrol edebilirsin."
        : "Seçilen görsel üreticisi hazır değil.";
    return "";
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function injectForgeControls(root) {
    const shell = root.querySelector(".fate-knots-hub");
    const headerActions = root.querySelector(".fate-knots-hub__header > .fate-knots-hub__actions");
    if (!shell || !headerActions) return;
    if (!forgeState.capabilities && !forgeState.status) requestCapabilities(false);
    const pending = readRecord(forgeState.capabilities?.pending);

    const openButton = headerActions.querySelector("[data-fate-knots-create]");
    const emptyButton = root.querySelector("[data-fate-knots-empty-create]");
    const toggle = function () {
      if (forgeState.submitting) return;
      forgeState.open = !forgeState.open;
      forgeState.status = "";
      if (forgeState.open) {
        forgeState.capabilities = null;
        requestCapabilities(true);
      }
      renderCurrent();
    };
    if (openButton) {
      openButton.disabled = forgeState.submitting || forgeState.capabilities?.busy === true;
      openButton.textContent = forgeState.open
        ? "Kapat"
        : pending
          ? "Yarım kalan evren"
          : "+ Yeni evren";
      openButton.setAttribute("aria-expanded", String(forgeState.open));
      openButton.onclick = toggle;
    }
    if (emptyButton) {
      emptyButton.hidden = forgeState.open;
      if (pending) emptyButton.textContent = "Yarım kalan evrene dön";
      emptyButton.onclick = toggle;
    }

    if (!forgeState.open) return;
    if (!forgeState.status) requestCapabilities(false);

    const panel = element("section", "fate-knots-forge");
    panel.setAttribute("aria-label", "Yeni evren");
    const heading = element("div", "fate-knots-forge__heading");
    heading.append(
      element("span", "fate-knots-hub__eyebrow", pending ? "YARIM KALAN HİKÂYE" : "YENİ HİKÂYE"),
      element(
        "h2",
        "fate-knots-hub__universe-title",
        pending ? "Evrenini tamamla" : "Evrenini şekillendir"
      ),
      element(
        "p",
        "fate-knots-hub__subtitle",
        pending
          ? "Kaydedilmiş üretime kaldığın yerden devam et."
          : "Bir dünya, karakterler ve keşfedilecek bir hikâye oluştur."
      )
    );
    panel.append(heading);

    const form = element("div", "fate-knots-forge__form");
    const settings = element("div", "fate-knots-forge__settings");
    const authorRow = element("label", "fate-knots-forge__field", "Evren yazarı");
    const authorSelect = makeProviderSelect("authoringProviders", forgeState.authoringProvider);
    authorSelect.addEventListener("change", function () {
      forgeState.authoringProvider = authorSelect.value;
      forgeState.status = "";
      renderCurrent();
    });
    authorSelect.disabled ||= Boolean(pending);
    authorRow.append(authorSelect);
    const assetRow = element("label", "fate-knots-forge__field", "Görsel üretimi");
    const assetSelect = makeProviderSelect("assetProviders", forgeState.assetProvider);
    assetSelect.addEventListener("change", function () {
      forgeState.assetProvider = assetSelect.value;
      forgeState.status = "";
      renderCurrent();
    });
    assetSelect.disabled ||= Boolean(pending?.assetProvider);
    assetRow.append(assetSelect);
    settings.append(authorRow, assetRow);
    form.append(settings);

    const briefLabel = element("label", "fate-knots-forge__field", "Evren fikri");
    const brief = document.createElement("textarea");
    brief.className = "fate-knots-forge__input fate-knots-forge__brief";
    brief.rows = 5;
    brief.maxLength = 8000;
    brief.placeholder =
      "Örneğin: Sisler altında kalmış bir liman kenti, kayıp bir krallık ve kadim bir sır…";
    brief.value = forgeState.brief;
    brief.disabled = Boolean(
      pending || forgeState.submitting || forgeState.capabilities?.busy === true
    );
    brief.addEventListener("input", function () {
      forgeState.brief = brief.value;
    });
    briefLabel.append(
      brief,
      element(
        "span",
        "fate-knots-forge__hint",
        "İsteğe bağlı. Boş bırakırsan evreni yapay zekâ tasarlar."
      )
    );
    form.append(briefLabel);
    panel.append(form);

    const capabilities = readRecord(forgeState.capabilities);
    const busy = forgeState.submitting || capabilities?.busy === true;
    const progress = busy ? readRecord(capabilities?.progress) : pending;
    if (progress && Number.isFinite(progress.totalAssets) && progress.totalAssets > 0) {
      const completed = Math.max(0, Math.min(progress.totalAssets, progress.completedAssets || 0));
      const area = element("div", "fate-knots-forge__progress");
      const line = element("div", "fate-knots-forge__progress-label");
      line.append(
        element("span", "", "Görseller"),
        element("span", "", completed + " / " + progress.totalAssets)
      );
      const bar = element("progress", "fate-knots-forge__progress-bar");
      bar.max = progress.totalAssets;
      bar.value = completed;
      bar.setAttribute("aria-label", "Tamamlanan görsel sayısı");
      area.append(line, bar);
      panel.append(area);
    }
    const footer = element("div", "fate-knots-forge__footer");
    const status = element(
      "div",
      "fate-knots-forge__status",
      forgeState.status || readinessMessage()
    );
    status.setAttribute("role", "status");
    if (busy) status.classList.add("is-busy");
    footer.append(status);

    const createButton = element(
      "button",
      "fate-knots-hub__button fate-knots-forge__create",
      busy ? "Oluşturuluyor…" : pending ? "Kaldığın yerden devam et" : "Evren oluştur"
    );
    createButton.type = "button";
    createButton.disabled = Boolean(
      busy ||
      !capabilities ||
      capabilities.storageAvailable !== true ||
      (!pending && !providerAvailable("authoringProviders", forgeState.authoringProvider)) ||
      !providerAvailable("assetProviders", forgeState.assetProvider)
    );
    createButton.addEventListener("click", function () {
      forgeState.submitting = true;
      forgeState.status = "";
      scheduleProgress();
      const sent = sendCommand(CREATE_COMMAND, {
        brief: forgeState.brief.trim() || null,
        ...(pending ? { resumeRequestId: pending.requestId } : {}),
        executionPolicy: {
          authoringProvider: forgeState.authoringProvider,
          assetProvider: forgeState.assetProvider,
        },
      });
      if (!sent) {
        forgeState.submitting = false;
        forgeState.status = "Evren oluşturma isteği gönderilemedi.";
      }
      renderCurrent();
    });
    footer.append(createButton);
    panel.append(footer);

    shell.insertBefore(panel, shell.children[1] || null);
  }

  ui.render = function renderWithForgeControls(root) {
    baseRender(root);
    injectForgeControls(root);
  };

  ui.handleCommandResult = function handleForgeCommandResult(message) {
    const record = readRecord(message);
    const command = readString(record?.command);
    const resultEnvelope = readRecord(record?.result) || {};
    const result = unwrapCommandResult(resultEnvelope);

    if (command === CAPABILITIES_COMMAND) {
      forgeState.requestedCapabilities = false;
      if (result.ok === true) {
        const previousPending = forgeState.capabilities?.pending?.requestId;
        forgeState.capabilities = result;
        const pending = readRecord(result.pending);
        if (pending) {
          forgeState.authoringProvider = pending.authoringProvider;
          forgeState.assetProvider = pending.assetProvider || forgeState.assetProvider;
          forgeState.brief = pending.brief || "";
          if (previousPending !== pending.requestId) forgeState.open = true;
        } else if (!result.busy) syncSelectionsFromCapabilities();
        if (result.busy) {
          forgeState.open = true;
          scheduleProgress();
        }
        forgeState.status = "";
      } else {
        forgeState.capabilities = null;
        forgeState.status =
          readString(result.message) ||
          readString(result.error) ||
          readString(resultEnvelope.message) ||
          readString(resultEnvelope.error) ||
          "World Forge hazırlık bilgisi alınamadı.";
      }
      renderCurrent();
      return true;
    }

    if (command === CREATE_COMMAND) {
      forgeState.submitting = false;
      if (progressTimer !== null) global.clearTimeout(progressTimer);
      progressTimer = null;
      forgeState.capabilities = readRecord(result.capabilities) || forgeState.capabilities;
      forgeState.requestedCapabilities = false;
      if (result.ok === true) {
        forgeState.open = false;
        forgeState.brief = "";
        forgeState.status = "";
        sendCommand("GameRoomFateKnotsGetHubState", {});
      } else {
        const pending = readRecord(forgeState.capabilities?.pending);
        if (pending) {
          forgeState.authoringProvider = pending.authoringProvider;
          forgeState.assetProvider = pending.assetProvider || forgeState.assetProvider;
          forgeState.brief = pending.brief || "";
        }
        const messageText = readString(result.message);
        forgeState.status = pending
          ? "Üretim tamamlanamadı. Başarılı görseller saklandı."
          : messageText || "Evren oluşturulamadı.";
      }
      renderCurrent();
      return true;
    }

    return baseHandleCommandResult ? baseHandleCommandResult(message) : false;
  };
})(window);
