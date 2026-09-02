/* global window, document */

(function (global) {
  const gameplayUi = global.GameRoomFateKnotsGameplayUi;
  if (!gameplayUi) return;

  const original = {
    dispose: gameplayUi.dispose,
    handleCommandResult: gameplayUi.handleCommandResult,
    handleState: gameplayUi.handleState,
    render: gameplayUi.render,
  };

  const state = {
    gameplay: null,
    camp: null,
    campOpenRequested: false,
    npcDialogue: null,
    npcDraftById: new Map(),
    selectedNpcId: "",
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

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function createButton(label, onClick, options) {
    const button = createElement("button", "fate-knots-gameplay__button", label);
    button.type = "button";
    if (options && options.secondary) button.classList.add("fate-knots-gameplay__button--secondary");
    if (options && options.selected) button.classList.add("is-selected");
    if (options && options.disabled) button.disabled = true;
    if (!button.disabled && typeof onClick === "function") button.addEventListener("click", onClick);
    return button;
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
    return true;
  }

  function currentRunId() {
    return readString(readRecord(state.gameplay)?.runId);
  }

  function isCamp() {
    return readRecord(state.gameplay)?.phase === "camp";
  }

  function isExploration() {
    return readRecord(state.gameplay)?.phase === "exploration";
  }

  function seatLabel(seatId) {
    if (seatId === "user") return "Sen";
    if (seatId === "ai2") return "AI2";
    if (seatId === "us1") return "US1";
    return seatId;
  }

  function requestCampOpen() {
    if (!isCamp() || state.campOpenRequested) return;
    state.campOpenRequested = true;
    if (!sendCommand("GameRoomFateKnotsOpenCamp", { runId: currentRunId() })) {
      state.campOpenRequested = false;
    }
  }

  function localPartyActor() {
    return (
      readArray(readRecord(state.gameplay)?.partyActors)
        .map(readRecord)
        .find(function (actor) {
          return actor && actor.seatId === "user";
        }) || null
    );
  }

  function cardById() {
    return new Map(
      readArray(readRecord(state.gameplay)?.cards)
        .map(readRecord)
        .filter(Boolean)
        .map(function (card) {
          return [readString(card.cardId), card];
        })
    );
  }

  function equipmentById() {
    return new Map(
      readArray(readRecord(state.gameplay)?.equipment)
        .map(readRecord)
        .filter(Boolean)
        .map(function (equipment) {
          return [readString(equipment.equipmentId), equipment];
        })
    );
  }

  function localOwnedEquipmentIds() {
    const actor = localPartyActor();
    if (!actor) return [];
    const cards = cardById();
    return Array.from(
      new Set(
        readArray(actor.ownedCardIds)
          .map(readString)
          .map(function (cardId) {
            const card = cards.get(cardId);
            return card && card.kind === "equipment" ? readString(card.sourceId) : "";
          })
          .filter(Boolean)
      )
    );
  }

  function localReady() {
    return readArray(readRecord(state.camp)?.readySeatIds).includes("user");
  }

  function setEquipment(slot, equipmentId) {
    if (!isCamp() || localReady()) return;
    state.lastMessage = "";
    sendCommand("GameRoomFateKnotsSetCampEquipment", {
      runId: currentRunId(),
      slot: slot,
      equipmentId: equipmentId,
    });
  }

  function readyCamp() {
    if (!isCamp() || localReady()) return;
    state.lastMessage = "";
    sendCommand("GameRoomFateKnotsReadyCamp", { runId: currentRunId() });
  }

  function renderCampReadiness(camp) {
    const row = createElement("div", "fate-knots-gameplay__readiness");
    const ready = new Set(readArray(camp.readySeatIds).map(readString));
    readArray(camp.activeSeatIds).forEach(function (entry) {
      const seatId = readString(entry);
      row.append(
        createElement(
          "span",
          ready.has(seatId)
            ? "fate-knots-gameplay__seat-state is-ready"
            : "fate-knots-gameplay__seat-state",
          `${seatLabel(seatId)} · ${ready.has(seatId) ? "hazır" : "kampı düzenliyor"}`
        )
      );
    });
    return row;
  }

  function renderCampEquipment() {
    const section = createElement("section", "fate-knots-gameplay__planning");
    section.append(createElement("h3", "fate-knots-gameplay__discussion-title", "Ekipman"));
    const actor = localPartyActor();
    if (!actor) {
      section.append(createElement("div", "fate-knots-gameplay__muted", "Yerel oyuncu karakteri bulunamadı."));
      return section;
    }

    const equipment = equipmentById();
    const ownedIds = localOwnedEquipmentIds();
    const currentIds = new Set(readArray(actor.equipmentIds).map(readString));
    const slots = Array.from(
      new Set(
        [...ownedIds, ...currentIds]
          .map(function (equipmentId) {
            return readString(equipment.get(equipmentId)?.slot);
          })
          .filter(Boolean)
      )
    );

    if (slots.length === 0) {
      section.append(
        createElement("div", "fate-knots-gameplay__muted", "Bu karakterin değiştirilebilir ekipmanı yok.")
      );
      return section;
    }

    slots.forEach(function (slot) {
      const group = createElement("div", "fate-knots-gameplay__option-group");
      group.append(createElement("div", "fate-knots-gameplay__option-title", slot));
      const row = createElement("div", "fate-knots-gameplay__option-row");
      const currentId = Array.from(currentIds).find(function (equipmentId) {
        return readString(equipment.get(equipmentId)?.slot) === slot;
      });
      row.append(
        createButton(
          "Boş",
          function () {
            setEquipment(slot, null);
          },
          { secondary: true, selected: !currentId, disabled: localReady() }
        )
      );
      ownedIds.forEach(function (equipmentId) {
        const definition = equipment.get(equipmentId);
        if (!definition || readString(definition.slot) !== slot) return;
        row.append(
          createButton(
            readString(definition.name) || "Ekipman",
            function () {
              setEquipment(slot, equipmentId);
            },
            { selected: currentId === equipmentId, disabled: localReady() }
          )
        );
      });
      group.append(row);
      section.append(group);
    });
    return section;
  }

  function renderCampPanel() {
    const interaction = createElement("div", "fate-knots-gameplay__interaction");
    const camp = readRecord(state.camp);
    const recovery = createElement("section", "fate-knots-gameplay__discussion");
    recovery.append(createElement("h3", "fate-knots-gameplay__discussion-title", "Kamp"));

    if (!camp) {
      recovery.append(
        createElement("div", "fate-knots-gameplay__muted", "Kamp durumu host tarafından hazırlanıyor…")
      );
      interaction.append(recovery, renderCampEquipment());
      return interaction;
    }

    recovery.append(
      createElement(
        "p",
        "fate-knots-gameplay__location-copy",
        "HP ve enerji toparlandı. Kalıcı durumlar ve yaralanmalar olduğu gibi kaldı."
      ),
      renderCampReadiness(camp)
    );

    if (localReady()) {
      recovery.append(
        createElement(
          "div",
          "fate-knots-gameplay__ready-note",
          "Hazırsın. Diğer aktif oyuncuların kampı tamamlaması bekleniyor."
        )
      );
    } else {
      recovery.append(
        createButton("Hazırım", readyCamp, { disabled: false })
      );
    }

    interaction.append(recovery, renderCampEquipment());
    return interaction;
  }

  function visibleNpcs() {
    return readArray(readRecord(state.gameplay)?.visibleNpcs).map(readRecord).filter(Boolean);
  }

  function currentNpc() {
    const npcs = visibleNpcs();
    if (npcs.length === 0) return null;
    const selected = npcs.find(function (npc) {
      return readString(npc.npcId) === state.selectedNpcId;
    });
    return selected || npcs[0];
  }

  function speakNpc(npcId) {
    const text = readString(state.npcDraftById.get(npcId)).trim();
    if (!text || !isExploration()) return;
    state.lastMessage = "";
    sendCommand("GameRoomFateKnotsSpeakNpc", {
      runId: currentRunId(),
      npcId: npcId,
      text: text,
    });
  }

  function renderNpcPanel() {
    const npcs = visibleNpcs();
    if (npcs.length === 0) return null;

    const section = createElement("section", "fate-knots-gameplay__discussion");
    section.append(createElement("h3", "fate-knots-gameplay__discussion-title", "Sahnedeki kişiler"));
    const selector = createElement("div", "fate-knots-gameplay__option-row");
    const active = currentNpc();
    if (active && !state.selectedNpcId) state.selectedNpcId = readString(active.npcId);

    npcs.forEach(function (npc) {
      const npcId = readString(npc.npcId);
      selector.append(
        createButton(
          readString(npc.name) || "Karakter",
          function () {
            state.selectedNpcId = npcId;
            state.npcDialogue = null;
            renderCurrent();
          },
          { secondary: true, selected: state.selectedNpcId === npcId }
        )
      );
    });
    section.append(selector);

    const npc = currentNpc();
    if (!npc) return section;
    const npcId = readString(npc.npcId);
    section.append(
      createElement("p", "fate-knots-gameplay__location-copy", readString(npc.publicSummary))
    );

    const dialogue = readRecord(state.npcDialogue);
    if (dialogue && readString(dialogue.npcId) === npcId) {
      section.append(
        createElement("div", "fate-knots-gameplay__message-text", readString(dialogue.utterance))
      );
      if (readString(dialogue.suggestedTransitionId)) {
        section.append(
          createElement(
            "div",
            "fate-knots-gameplay__ready-note",
            "Bu konuşma ortak karar seçeneklerinden birini işaret ediyor; yol ancak oyuncu consensus'u ile açılır."
          )
        );
      }
    }

    const compose = createElement("div", "fate-knots-gameplay__compose");
    const input = document.createElement("textarea");
    input.className = "fate-knots-gameplay__chat-input";
    input.rows = 2;
    input.maxLength = 2000;
    input.placeholder = `${readString(npc.name) || "Karakter"} ile konuş…`;
    input.value = readString(state.npcDraftById.get(npcId));
    input.addEventListener("input", function () {
      state.npcDraftById.set(npcId, input.value);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        state.npcDraftById.set(npcId, input.value);
        speakNpc(npcId);
      }
    });
    compose.append(
      input,
      createButton("Konuş", function () {
        state.npcDraftById.set(npcId, input.value);
        speakNpc(npcId);
      })
    );
    section.append(compose);
    return section;
  }

  function render(root) {
    const rendered = typeof original.render === "function" ? original.render(root) : false;
    if (!rendered) return rendered;
    const shell = root.querySelector(".fate-knots-gameplay");
    if (!shell) return rendered;

    if (isCamp()) shell.append(renderCampPanel());
    else if (isExploration()) {
      const npcPanel = renderNpcPanel();
      if (npcPanel) shell.append(npcPanel);
    }

    if (state.lastMessage) {
      shell.append(createElement("div", "fate-knots-gameplay__notice", state.lastMessage));
    }
    return rendered;
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root && state.gameplay) render(root);
  }

  function handleState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    const nextState = payload && "state" in payload ? readRecord(payload.state) : null;
    const previousRunId = currentRunId();
    state.gameplay = nextState;

    const handled = typeof original.handleState === "function" ? original.handleState(message) : false;

    const nextRunId = readString(nextState?.runId);
    if (previousRunId && nextRunId && previousRunId !== nextRunId) {
      state.camp = null;
      state.campOpenRequested = false;
      state.npcDialogue = null;
      state.npcDraftById.clear();
      state.selectedNpcId = "";
    }

    if (isCamp()) {
      state.npcDialogue = null;
      requestCampOpen();
    } else {
      state.camp = null;
      state.campOpenRequested = false;
    }

    if (!isExploration()) {
      state.npcDialogue = null;
      state.selectedNpcId = "";
    }
    return handled;
  }

  function handleCampState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    if (!payload || !("state" in payload)) return false;
    state.camp = readRecord(payload.state);
    state.lastMessage = "";
    renderCurrent();
    return true;
  }

  function handleNpcDialogueState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    if (!payload || !("state" in payload)) return false;
    state.npcDialogue = readRecord(payload.state);
    state.lastMessage = "";
    renderCurrent();
    return true;
  }

  function commandErrorMessage(result) {
    const error = readString(result?.error);
    if (error === "seat-already-ready") return "Bu kamp için hazır durumun zaten kilitli.";
    if (error === "seat-not-active") return "Bu koltuk aktif partiye bağlı değil.";
    if (error === "camp-rejected") return "Kamp işlemi mevcut canonical durumda uygulanamadı.";
    if (error === "npc-interaction-rejected") return "Bu kişiyle konuşma artık bu sahnede geçerli değil.";
    if (error === "ai0-dialogue-failed") return "NPC yanıtı alınamadı; canonical oyun durumu değişmedi.";
    if (error === "persistence-rejected" || error === "save-rejected") {
      return "Kayıt durumu güvenli biçimde güncellenemedi.";
    }
    return "Fate Knots işlemi tamamlanamadı.";
  }

  function handleCommandResult(message) {
    const record = readRecord(message);
    const command = readString(record?.command);
    const isCampCommand = command.startsWith("GameRoomFateKnots") && command.includes("Camp");
    const isNpcCommand = command === "GameRoomFateKnotsSpeakNpc";
    if (!isCampCommand && !isNpcCommand) {
      return typeof original.handleCommandResult === "function"
        ? original.handleCommandResult(message)
        : false;
    }

    const result = readRecord(record?.result) || {};
    if (result.ok !== true) {
      state.lastMessage = commandErrorMessage(result);
      if (command === "GameRoomFateKnotsOpenCamp") state.campOpenRequested = false;
      renderCurrent();
      return true;
    }

    const commandState = readRecord(result.state);
    state.lastMessage = "";
    if (isCampCommand) {
      state.camp = commandState?.exited === true ? null : commandState;
      if (commandState?.exited === true) state.campOpenRequested = false;
    } else if (isNpcCommand) {
      state.npcDialogue = commandState;
      const npcId = readString(commandState?.npcId);
      if (npcId) state.npcDraftById.set(npcId, "");
    }
    renderCurrent();
    return true;
  }

  function dispose() {
    state.gameplay = null;
    state.camp = null;
    state.campOpenRequested = false;
    state.npcDialogue = null;
    state.npcDraftById.clear();
    state.selectedNpcId = "";
    state.lastMessage = "";
    if (typeof original.dispose === "function") original.dispose();
  }

  gameplayUi.dispose = dispose;
  gameplayUi.handleCampState = handleCampState;
  gameplayUi.handleCommandResult = handleCommandResult;
  gameplayUi.handleNpcDialogueState = handleNpcDialogueState;
  gameplayUi.handleState = handleState;
  gameplayUi.render = render;
})(window);
