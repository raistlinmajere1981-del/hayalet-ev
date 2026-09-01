/* global window, document */

(function (global) {
  const state = {
    hub: null,
    lastMessage: "",
  };

  function readRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function readArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function sendCommand(name, payload) {
    const roomApi = global.roomAPI;
    if (!roomApi || typeof roomApi.sendCommand !== "function") {
      state.lastMessage = "Oda bağlantısı hazır değil.";
      renderCurrent();
      return false;
    }
    const sent = roomApi.sendCommand(name, payload || {});
    if (sent !== true) {
      state.lastMessage = "Komut oda host'una gönderilemedi.";
      renderCurrent();
      return false;
    }
    state.lastMessage = "";
    return true;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function createButton(label, onClick, options) {
    const button = createElement("button", "fate-knots-hub__button", label);
    button.type = "button";
    if (options && options.secondary) button.classList.add("fate-knots-hub__button--secondary");
    if (options && options.danger) button.classList.add("fate-knots-hub__button--danger");
    if (options && options.disabled) button.disabled = true;
    if (!button.disabled && typeof onClick === "function") button.addEventListener("click", onClick);
    return button;
  }

  function formatRunStatus(run) {
    if (!run || typeof run !== "object") return "";
    if (run.result === "completed") return "Tamamlandı";
    if (run.result === "failed") return "Sona erdi";
    if (run.phase === "run-setup") return "Hazırlık";
    return "Devam ediyor";
  }

  function renderRun(run) {
    const row = createElement("div", "fate-knots-hub__run");
    const copy = createElement("div", "fate-knots-hub__run-copy");
    copy.append(
      createElement("strong", "fate-knots-hub__run-title", formatRunStatus(run)),
      createElement("span", "fate-knots-hub__run-meta", `Revizyon ${String(run.revision || 0)}`)
    );
    row.append(copy);

    const actions = createElement("div", "fate-knots-hub__actions");
    if (run.canContinue === true) {
      actions.append(
        createButton("Devam et", function () {
          sendCommand("GameRoomFateKnotsActivateRun", { runId: run.runId });
        })
      );
    }
    actions.append(
      createButton(
        "Sil",
        function () {
          sendCommand("GameRoomFateKnotsDeleteRun", { runId: run.runId });
        },
        { danger: true }
      )
    );
    row.append(actions);
    return row;
  }

  function renderUniverse(universe, runs) {
    const card = createElement("article", "fate-knots-hub__universe");
    const heading = createElement("div", "fate-knots-hub__universe-heading");
    const copy = createElement("div", "fate-knots-hub__universe-copy");
    copy.append(
      createElement("h2", "fate-knots-hub__universe-title", universe.title || "Adsız Evren"),
      createElement(
        "p",
        "fate-knots-hub__universe-meta",
        runs.length === 0 ? "Henüz koşu yok" : `${runs.length} kayıtlı koşu`
      )
    );
    heading.append(copy);

    const actions = createElement("div", "fate-knots-hub__actions");
    actions.append(
      createButton(
        "Seç",
        function () {
          sendCommand("GameRoomFateKnotsActivateUniverse", { universeId: universe.universeId });
        },
        { secondary: true }
      ),
      createButton(
        "Sil",
        function () {
          sendCommand("GameRoomFateKnotsDeleteUniverse", { universeId: universe.universeId });
        },
        { danger: true }
      )
    );
    heading.append(actions);
    card.append(heading);

    const runList = createElement("div", "fate-knots-hub__runs");
    runs.forEach(function (run) {
      runList.append(renderRun(run));
    });
    if (runs.length > 0) card.append(runList);
    return card;
  }

  function render(root) {
    root.classList.remove("yahtzee-root");
    root.classList.add("fate-knots-hub-root");
    root.replaceChildren();

    const shell = createElement("main", "fate-knots-hub");
    const header = createElement("header", "fate-knots-hub__header");
    const titleGroup = createElement("div", "fate-knots-hub__title-group");
    titleGroup.append(
      createElement("div", "fate-knots-hub__eyebrow", "FATE KNOTS"),
      createElement("h1", "fate-knots-hub__title", "Kader Düğümleri"),
      createElement(
        "p",
        "fate-knots-hub__subtitle",
        "Kaydedilmiş evrenlerini yönet; bir evren seçildiğinde oyun kendi kitabını açar."
      )
    );
    header.append(titleGroup);

    const headerActions = createElement("div", "fate-knots-hub__actions");
    headerActions.append(
      createButton(
        "Yenile",
        function () {
          sendCommand("GameRoomFateKnotsGetHubState", {});
        },
        { secondary: true }
      ),
      createButton("Yeni Evren", null, { disabled: true })
    );
    header.append(headerActions);
    shell.append(header);

    const hub = readRecord(state.hub);
    if (!hub) {
      shell.append(
        createElement("div", "fate-knots-hub__empty", "Kayıt bilgileri host'tan bekleniyor…")
      );
      root.append(shell);
      return;
    }

    if (hub.hasStorageIssues === true) {
      shell.append(
        createElement(
          "div",
          "fate-knots-hub__warning",
          "Bazı Fate Knots kayıtları doğrulanamadı. Host bu kayıtları otomatik olarak yeniden yazmadı."
        )
      );
    }

    const universes = readArray(hub.universes);
    const runs = readArray(hub.runs);
    const content = createElement("section", "fate-knots-hub__content");
    if (universes.length === 0) {
      content.append(
        createElement(
          "div",
          "fate-knots-hub__empty",
          "Henüz kaydedilmiş bir evren yok. World Forge bağlantısı tamamlandığında yeni evren burada oluşturulacak."
        )
      );
    } else {
      universes.forEach(function (universe) {
        const universeRuns = runs.filter(function (run) {
          return run && run.universeId === universe.universeId;
        });
        content.append(renderUniverse(universe, universeRuns));
      });
    }
    shell.append(content);

    if (state.lastMessage) {
      shell.append(createElement("div", "fate-knots-hub__message", state.lastMessage));
    }
    root.append(shell);
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root) render(root);
  }

  function handleState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    const nextState = payload ? readRecord(payload.state) : null;
    if (!nextState) return false;
    state.hub = nextState;
    return true;
  }

  function dispose() {
    const root = document.getElementById("app");
    if (root) root.classList.remove("fate-knots-hub-root");
  }

  global.GameRoomFateKnotsUi = {
    dispose: dispose,
    handleState: handleState,
    render: render,
  };
})(window);
