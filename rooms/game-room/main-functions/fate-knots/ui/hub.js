/* global window, document */

(function (global) {
  const PLAYER_SEAT_IDS = ["user", "ai2", "us1"];
  const state = {
    hub: null,
    setup: null,
    context: null,
    seatEnabled: {
      user: true,
      ai2: false,
      us1: false,
    },
    assignments: {
      user: null,
      ai2: null,
      us1: null,
    },
    lastMessage: "",
  };

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
    if (options && options.selected) button.classList.add("is-selected");
    if (options && options.disabled) button.disabled = true;
    if (!button.disabled && typeof onClick === "function") button.addEventListener("click", onClick);
    return button;
  }

  function seatLabel(seatId) {
    if (seatId === "user") return "Sen";
    if (seatId === "ai2") return "AI2";
    return "US1";
  }

  function isSeatAvailable(seatId) {
    if (seatId === "user") return true;
    const context = readRecord(state.context);
    const slots = context ? readRecord(context.slots) : null;
    const slot = slots ? readRecord(slots[seatId]) : null;
    return Boolean(slot && slot.dispatchable === true);
  }

  function resetSetupSelection() {
    state.seatEnabled = {
      user: true,
      ai2: false,
      us1: false,
    };
    state.assignments = {
      user: null,
      ai2: null,
      us1: null,
    };
  }

  function beginRunSetup(universeId) {
    state.setup = null;
    resetSetupSelection();
    state.lastMessage = "Karakter seçenekleri hazırlanıyor…";
    renderCurrent();
    sendCommand("GameRoomFateKnotsGetRunSetup", { universeId: universeId });
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
      if (run.phase === "run-setup") {
        actions.append(
          createButton("Başlat", function () {
            sendCommand("GameRoomFateKnotsStartRun", { runId: run.runId });
          })
        );
      } else {
        actions.append(
          createButton("Devam et", function () {
            sendCommand("GameRoomFateKnotsActivateRun", { runId: run.runId });
          })
        );
      }
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
      createButton("Yeni koşu", function () {
        beginRunSetup(universe.universeId);
      }),
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

  function isCharacterAssignedElsewhere(characterId, seatId) {
    return PLAYER_SEAT_IDS.some(function (candidateSeatId) {
      return (
        candidateSeatId !== seatId &&
        state.seatEnabled[candidateSeatId] === true &&
        state.assignments[candidateSeatId] === characterId
      );
    });
  }

  function renderCharacterChoice(character, seatId) {
    const characterId = readString(character.characterId);
    const selected = state.assignments[seatId] === characterId;
    const usedElsewhere = isCharacterAssignedElsewhere(characterId, seatId);
    const button = createButton(
      readString(character.name) || "Adsız karakter",
      function () {
        state.assignments[seatId] = selected ? null : characterId;
        renderCurrent();
      },
      { selected: selected, disabled: usedElsewhere }
    );
    button.classList.add("fate-knots-hub__character-choice");

    const stats = readRecord(character.baseStats) || {};
    const position = readRecord(character.startingPosition) || {};
    const details = [
      `HP ${String(stats.maxHp ?? "-")}`,
      `ATK ${String(stats.attack ?? "-")}`,
      `DEF ${String(stats.defense ?? "-")}`,
      `SPD ${String(stats.speed ?? "-")}`,
      `ENG ${String(stats.energy ?? "-")}`,
      `${readString(position.row) || "-"}/${readString(position.range) || "-"}`,
    ].join(" · ");
    button.append(createElement("span", "fate-knots-hub__character-meta", details));

    const startingCards = readArray(character.startingCards);
    const startingEquipment = readArray(character.startingEquipment);
    const loadout = [
      ...startingCards.map(function (card) {
        return readString(readRecord(card)?.name);
      }),
      ...startingEquipment.map(function (equipment) {
        return readString(readRecord(equipment)?.name);
      }),
    ].filter(Boolean);
    if (loadout.length > 0) {
      button.append(
        createElement("span", "fate-knots-hub__character-loadout", loadout.join(" · "))
      );
    }
    return button;
  }

  function renderSeatSetup(setup, seatId) {
    const available = isSeatAvailable(seatId);
    const enabled = state.seatEnabled[seatId] === true;
    const section = createElement("section", "fate-knots-hub__seat");
    const heading = createElement("div", "fate-knots-hub__seat-heading");
    const titleGroup = createElement("div", "fate-knots-hub__seat-title-group");
    titleGroup.append(
      createElement("h3", "fate-knots-hub__seat-title", seatLabel(seatId)),
      createElement(
        "span",
        "fate-knots-hub__seat-status",
        seatId === "user"
          ? "Zorunlu oyuncu"
          : available
            ? enabled
              ? "Katılıyor"
              : "Uygun"
            : "Bağlı değil"
      )
    );
    heading.append(titleGroup);

    if (seatId !== "user") {
      heading.append(
        createButton(
          enabled ? "Çıkar" : "Kat",
          function () {
            state.seatEnabled[seatId] = !enabled;
            if (enabled) state.assignments[seatId] = null;
            renderCurrent();
          },
          { secondary: true, disabled: !available }
        )
      );
    }
    section.append(heading);

    if (enabled) {
      const choices = createElement("div", "fate-knots-hub__character-grid");
      readArray(setup.characters).forEach(function (character) {
        const record = readRecord(character);
        if (record) choices.append(renderCharacterChoice(record, seatId));
      });
      section.append(choices);
    }
    return section;
  }

  function getEnabledSeatIds() {
    return PLAYER_SEAT_IDS.filter(function (seatId) {
      return state.seatEnabled[seatId] === true && isSeatAvailable(seatId);
    });
  }

  function canCreateRun() {
    const seats = getEnabledSeatIds();
    if (seats.length === 0 || !state.seatEnabled.user) return false;
    const selectedIds = seats.map(function (seatId) {
      return state.assignments[seatId];
    });
    return selectedIds.every(Boolean) && new Set(selectedIds).size === selectedIds.length;
  }

  function createRunFromSetup(setup) {
    if (!canCreateRun()) return;
    const party = getEnabledSeatIds().map(function (seatId) {
      return {
        seatId: seatId,
        characterId: state.assignments[seatId],
      };
    });
    sendCommand("GameRoomFateKnotsCreateRun", {
      universeId: setup.universeId,
      party: party,
    });
  }

  function renderRunSetup() {
    const setup = readRecord(state.setup);
    if (!setup) return null;

    const panel = createElement("section", "fate-knots-hub__setup");
    const heading = createElement("div", "fate-knots-hub__setup-heading");
    const copy = createElement("div");
    copy.append(
      createElement("div", "fate-knots-hub__eyebrow", "RUN SETUP"),
      createElement("h2", "fate-knots-hub__setup-title", readString(setup.title) || "Koşu hazırlığı"),
      createElement(
        "p",
        "fate-knots-hub__setup-copy",
        "Katılacak oyuncuları ve her biri için farklı bir karakter seç. Bu ekran yalnız oyuncuya açık başlangıç bilgilerini gösterir."
      )
    );
    heading.append(copy);
    heading.append(
      createButton(
        "Kapat",
        function () {
          state.setup = null;
          resetSetupSelection();
          renderCurrent();
        },
        { secondary: true }
      )
    );
    panel.append(heading);

    const characters = readArray(setup.characters);
    if (characters.length === 0) {
      panel.append(
        createElement("div", "fate-knots-hub__warning", "Bu evrende oyuncuya açık karakter yok.")
      );
      return panel;
    }

    PLAYER_SEAT_IDS.forEach(function (seatId) {
      panel.append(renderSeatSetup(setup, seatId));
    });

    const footer = createElement("div", "fate-knots-hub__setup-footer");
    footer.append(
      createElement(
        "span",
        "fate-knots-hub__setup-note",
        "Koşu önce hazırlık olarak kaydedilir; başlangıç düğümü ayrı Başlat eyleminde açılır."
      ),
      createButton(
        "Koşuyu hazırla",
        function () {
          createRunFromSetup(setup);
        },
        { disabled: !canCreateRun() }
      )
    );
    panel.append(footer);
    return panel;
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

    const setupPanel = renderRunSetup();
    if (setupPanel) shell.append(setupPanel);

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

  function commandErrorMessage(result) {
    const error = readString(result && result.error);
    if (error === "universe-not-found") return "Seçilen evren artık bulunamıyor.";
    if (error === "run-not-found") return "Seçilen koşu artık bulunamıyor.";
    if (error === "run-setup-rejected") return "Koşu hazırlığı host kuralları tarafından reddedildi.";
    if (error === "universe-rejected") return "Evren canonical doğrulamadan geçemedi.";
    if (error === "persistence-rejected") return "Kayıt durumu güvenli biçimde okunamadı.";
    if (error === "invalid-payload") return "Gönderilen hazırlık bilgisi geçersiz.";
    return "Fate Knots komutu tamamlanamadı.";
  }

  function handleCommandResult(message) {
    const record = readRecord(message);
    if (!record) return false;
    const command = readString(record.command);
    if (!command.startsWith("GameRoomFateKnots")) return false;
    const result = readRecord(record.result) || {};

    if (command === "GameRoomFateKnotsGetRunSetup") {
      const setup = readRecord(result.setup);
      if (result.ok === true && setup) {
        state.setup = setup;
        resetSetupSelection();
        state.lastMessage = "";
      } else {
        state.setup = null;
        state.lastMessage = commandErrorMessage(result);
      }
      return true;
    }

    if (command === "GameRoomFateKnotsCreateRun") {
      if (result.ok === true) {
        state.setup = null;
        resetSetupSelection();
        state.lastMessage = "Koşu hazırlandı. Kayıt listesindeki Başlat eylemi dünyayı açacak.";
      } else {
        state.lastMessage = commandErrorMessage(result);
      }
      return true;
    }

    if (command === "GameRoomFateKnotsStartRun") {
      state.lastMessage =
        result.ok === true
          ? "Koşu başlangıç düğümünde açıldı."
          : commandErrorMessage(result);
      return true;
    }

    if (result.ok === false) {
      state.lastMessage = commandErrorMessage(result);
    }
    return true;
  }

  function setContext(context) {
    state.context = readRecord(context);
    if (!isSeatAvailable("ai2")) {
      state.seatEnabled.ai2 = false;
      state.assignments.ai2 = null;
    }
    if (!isSeatAvailable("us1")) {
      state.seatEnabled.us1 = false;
      state.assignments.us1 = null;
    }
  }

  function dispose() {
    const root = document.getElementById("app");
    if (root) root.classList.remove("fate-knots-hub-root");
  }

  global.GameRoomFateKnotsUi = {
    dispose: dispose,
    handleCommandResult: handleCommandResult,
    handleState: handleState,
    render: render,
    setContext: setContext,
  };
})(window);
