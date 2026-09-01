/* global window, document */
(function (global) {
  "use strict";

  const FEATURE_ID = "fate-knots";
  const COMMANDS = Object.freeze({
    refresh: "GameRoomFateKnotsRefresh",
    createUniverse: "GameRoomFateKnotsCreateUniverse",
    activateUniverse: "GameRoomFateKnotsActivateUniverse",
    deleteUniverse: "GameRoomFateKnotsDeleteUniverse",
    activateRun: "GameRoomFateKnotsActivateRun",
    deleteRun: "GameRoomFateKnotsDeleteRun",
  });

  let hostState = null;
  let lastMessage = "";

  function isRecord(value) {
    return value !== null && typeof value === "object" && Array.isArray(value) === false;
  }

  function readArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readString(value, fallback) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  }

  function currentLocale() {
    const language = document.documentElement.lang || "en";
    return language.toLowerCase().startsWith("tr") ? "tr" : "en";
  }

  function copy() {
    return currentLocale() === "tr"
      ? {
          title: "Kader Düğümleri",
          subtitle: "Evren seçimi ve kayıt yönetimi",
          intro:
            "Bir evren oluşturulmadan önce Fate Knots tarafsız bir merkezde kalır. Evren hazır olduğunda oyun onun kendi yaşayan kitabına dönüşür.",
          continueTitle: "Devam et",
          universesTitle: "Kayıtlı evrenler",
          noRun: "Devam edilecek aktif oyun yok.",
          noUniverse: "Henüz kayıtlı evren yok.",
          continueAction: "Oyunu etkinleştir",
          openUniverse: "Evreni etkinleştir",
          deleteAction: "Sil",
          forgeTitle: "Yeni evren",
          forgeReady:
            "World Forge hazır. İstersen kısa bir yön ver, istersen alanı boş bırakıp evreni Forge'a bırak.",
          forgeUnavailable: "World Forge henüz bütün bağımlılıklarıyla hazır değil.",
          forgeBusy: "World Forge çalışıyor",
          createUniverse: "Evren oluştur",
          briefPlaceholder: "İsteğe bağlı kısa yön: tema, atmosfer veya başlangıç fikri…",
          blockerAi1: "AI1 bağlantısı yok",
          blockerMaterializer: "görsel materializer bağlanmadı",
          blockerStorage: "kalıcı depolama kullanılamıyor",
          blockerBusy: "başka bir Forge işlemi sürüyor",
          refresh: "Yenile",
          active: "Aktif",
          completed: "Tamamlandı",
          failed: "Başarısız",
          phase: "Aşama",
          revision: "Revizyon",
          persistenceWarning: "Bazı kayıt girdileri doğrulamada reddedildi.",
          commandFailed: "İşlem host tarafından tamamlanamadı.",
        }
      : {
          title: "Fate Knots",
          subtitle: "Universe selection and save management",
          intro:
            "Before a universe exists, Fate Knots stays in a neutral hub. Once a universe is ready, play moves into that universe's own living book.",
          continueTitle: "Continue",
          universesTitle: "Saved universes",
          noRun: "There is no active run to continue.",
          noUniverse: "No universes have been saved yet.",
          continueAction: "Activate run",
          openUniverse: "Activate universe",
          deleteAction: "Delete",
          forgeTitle: "New universe",
          forgeReady:
            "World Forge is ready. Add a short direction if useful, or leave it empty and let Forge choose the universe.",
          forgeUnavailable: "World Forge is not ready with all required dependencies yet.",
          forgeBusy: "World Forge is running",
          createUniverse: "Create universe",
          briefPlaceholder: "Optional direction: theme, atmosphere, or starting idea…",
          blockerAi1: "AI1 transport unavailable",
          blockerMaterializer: "image materializer not connected",
          blockerStorage: "durable storage unavailable",
          blockerBusy: "another Forge run is active",
          refresh: "Refresh",
          active: "Active",
          completed: "Completed",
          failed: "Failed",
          phase: "Phase",
          revision: "Revision",
          persistenceWarning: "Some stored entries were rejected during validation.",
          commandFailed: "The room host could not complete the action.",
        };
  }

  function sendCommand(command, payload) {
    const roomApi = global.roomAPI;
    if (!roomApi || typeof roomApi.sendCommand !== "function") {
      lastMessage = copy().commandFailed;
      return false;
    }
    const sent = roomApi.sendCommand(command, payload || {});
    if (sent !== true) lastMessage = copy().commandFailed;
    return sent === true;
  }

  function button(label, className, handler, disabled) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = label;
    element.disabled = disabled === true;
    if (!element.disabled) element.addEventListener("click", handler);
    return element;
  }

  function metaChip(text) {
    const chip = document.createElement("span");
    chip.className = "fk-hub__chip";
    chip.textContent = text;
    return chip;
  }

  function forgeBlockerText(blocker, labels) {
    if (blocker === "ai1-transport-unavailable") return labels.blockerAi1;
    if (blocker === "asset-materializer-unavailable") return labels.blockerMaterializer;
    if (blocker === "storage-unavailable") return labels.blockerStorage;
    if (blocker === "forge-busy") return labels.blockerBusy;
    return blocker;
  }

  function renderRunCard(container, run, state, labels) {
    const card = document.createElement("article");
    card.className = "fk-hub__record fk-hub__record--run";
    const heading = document.createElement("div");
    heading.className = "fk-hub__record-heading";
    const title = document.createElement("strong");
    title.textContent = readString(run.runId, "run");
    heading.append(title);
    if (state.activeRunId === run.runId) heading.append(metaChip(labels.active));
    card.append(heading);

    const meta = document.createElement("div");
    meta.className = "fk-hub__record-meta";
    meta.append(metaChip(`${labels.phase}: ${readString(run.phase, "-")}`));
    meta.append(metaChip(`${labels.revision}: ${String(run.revision ?? 0)}`));
    if (run.result === "completed") meta.append(metaChip(labels.completed));
    if (run.result === "failed") meta.append(metaChip(labels.failed));
    card.append(meta);

    const actions = document.createElement("div");
    actions.className = "fk-hub__record-actions";
    actions.append(
      button(labels.continueAction, "fk-hub__button fk-hub__button--primary", function () {
        sendCommand(COMMANDS.activateRun, { runId: run.runId });
      })
    );
    actions.append(
      button(labels.deleteAction, "fk-hub__button fk-hub__button--quiet", function () {
        sendCommand(COMMANDS.deleteRun, { runId: run.runId });
      })
    );
    card.append(actions);
    container.append(card);
  }

  function renderUniverseCard(container, universe, state, labels) {
    const card = document.createElement("article");
    card.className = "fk-hub__record";
    const heading = document.createElement("div");
    heading.className = "fk-hub__record-heading";
    const title = document.createElement("strong");
    title.textContent = readString(universe.title, readString(universe.universeId, "universe"));
    heading.append(title);
    if (state.activeUniverseId === universe.universeId) heading.append(metaChip(labels.active));
    card.append(heading);

    const premise = document.createElement("p");
    premise.className = "fk-hub__record-copy";
    premise.textContent = readString(universe.premise, "");
    card.append(premise);

    const actions = document.createElement("div");
    actions.className = "fk-hub__record-actions";
    actions.append(
      button(labels.openUniverse, "fk-hub__button fk-hub__button--primary", function () {
        sendCommand(COMMANDS.activateUniverse, { universeId: universe.universeId });
      })
    );
    actions.append(
      button(labels.deleteAction, "fk-hub__button fk-hub__button--quiet", function () {
        sendCommand(COMMANDS.deleteUniverse, { universeId: universe.universeId });
      })
    );
    card.append(actions);
    container.append(card);
  }

  function renderForgePanel(container, state, labels) {
    const forge = isRecord(state.forge) ? state.forge : {};
    const progress = isRecord(forge.progress) ? forge.progress : null;
    const blockers = readArray(forge.blockers);
    const busy = forge.busy === true;
    const ready = forge.ready === true;

    const title = document.createElement("h2");
    title.textContent = labels.forgeTitle;
    const body = document.createElement("p");
    body.className = "fk-hub__record-copy";

    if (busy && progress) {
      const total = Number(progress.totalAssets || 0);
      const completed = Number(progress.completedAssets || 0);
      body.textContent =
        readString(progress.message, labels.forgeBusy) +
        (total > 0 ? ` · ${completed}/${total}` : "");
    } else if (ready) {
      body.textContent = labels.forgeReady;
    } else {
      const details = blockers
        .filter(function (blocker) {
          return blocker !== "forge-busy";
        })
        .map(function (blocker) {
          return forgeBlockerText(blocker, labels);
        });
      body.textContent =
        labels.forgeUnavailable + (details.length > 0 ? ` ${details.join(" · ")}.` : "");
    }

    const brief = document.createElement("textarea");
    brief.className = "fk-hub__forge-brief";
    brief.rows = 3;
    brief.placeholder = labels.briefPlaceholder;
    brief.disabled = !ready || busy;

    const action = button(
      busy ? labels.forgeBusy : labels.createUniverse,
      "fk-hub__button fk-hub__button--primary",
      function () {
        sendCommand(COMMANDS.createUniverse, { brief: brief.value.trim() });
      },
      !ready || busy
    );

    container.append(title, body, brief, action);
  }

  function render(root) {
    const labels = copy();
    const state = isRecord(hostState) ? hostState : {};
    const universes = readArray(state.universes);
    const runs = readArray(state.runs);
    root.innerHTML = "";

    const shell = document.createElement("main");
    shell.className = "fk-hub";

    const header = document.createElement("header");
    header.className = "fk-hub__header";
    const headingGroup = document.createElement("div");
    const eyebrow = document.createElement("div");
    eyebrow.className = "fk-hub__eyebrow";
    eyebrow.textContent = labels.subtitle;
    const title = document.createElement("h1");
    title.textContent = labels.title;
    const intro = document.createElement("p");
    intro.textContent = labels.intro;
    headingGroup.append(eyebrow, title, intro);
    header.append(headingGroup);
    header.append(
      button(labels.refresh, "fk-hub__button fk-hub__button--quiet", function () {
        sendCommand(COMMANDS.refresh, {});
      })
    );
    shell.append(header);

    if (Number(state.persistenceIssueCount || 0) > 0) {
      const warning = document.createElement("div");
      warning.className = "fk-hub__warning";
      warning.textContent = labels.persistenceWarning;
      shell.append(warning);
    }
    if (lastMessage) {
      const note = document.createElement("div");
      note.className = "fk-hub__warning";
      note.textContent = lastMessage;
      shell.append(note);
    }

    const grid = document.createElement("div");
    grid.className = "fk-hub__grid";

    const continueSection = document.createElement("section");
    continueSection.className = "fk-hub__panel";
    const continueTitle = document.createElement("h2");
    continueTitle.textContent = labels.continueTitle;
    continueSection.append(continueTitle);
    const activeRun = runs.find(function (run) {
      return isRecord(run) && run.runId === state.activeRunId;
    });
    if (activeRun) renderRunCard(continueSection, activeRun, state, labels);
    else {
      const empty = document.createElement("p");
      empty.className = "fk-hub__empty";
      empty.textContent = labels.noRun;
      continueSection.append(empty);
    }
    grid.append(continueSection);

    const forgeSection = document.createElement("section");
    forgeSection.className = "fk-hub__panel fk-hub__panel--forge";
    renderForgePanel(forgeSection, state, labels);
    grid.append(forgeSection);
    shell.append(grid);

    const universeSection = document.createElement("section");
    universeSection.className = "fk-hub__panel fk-hub__panel--wide";
    const universeTitle = document.createElement("h2");
    universeTitle.textContent = labels.universesTitle;
    universeSection.append(universeTitle);
    if (universes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "fk-hub__empty";
      empty.textContent = labels.noUniverse;
      universeSection.append(empty);
    } else {
      const records = document.createElement("div");
      records.className = "fk-hub__records";
      universes.forEach(function (universe) {
        if (isRecord(universe)) renderUniverseCard(records, universe, state, labels);
      });
      universeSection.append(records);
    }
    shell.append(universeSection);
    root.append(shell);
  }

  function handleHostMessage(message) {
    if (!isRecord(message)) return false;
    if (message.type === "fate-knots-state" && isRecord(message.state)) {
      hostState = message.state;
      lastMessage = "";
      return true;
    }
    if (message.type === "command-result" && isRecord(message.result)) {
      const resultState = message.result.state;
      if (isRecord(resultState) && resultState.featureId === FEATURE_ID) {
        hostState = resultState;
        lastMessage = readString(message.result.message, "");
        return true;
      }
    }
    return false;
  }

  global.GameRoomFateKnotsHub = {
    featureId: FEATURE_ID,
    handleHostMessage: handleHostMessage,
    render: render,
  };
})(window);
