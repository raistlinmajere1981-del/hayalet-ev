/* global window, document */

(function (global) {
  const state = {
    gameplay: null,
    combatOptions: null,
    discussion: null,
    requestedCombatKey: "",
    requestedResolutionKey: "",
    movementCardId: null,
    actionCardId: null,
    primaryTargetId: null,
    draftText: "",
    lastResolvedCards: [],
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
    return true;
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

  function currentRunId() {
    return readString(readRecord(state.gameplay)?.runId);
  }

  function currentCombat() {
    return readRecord(readRecord(state.gameplay)?.combat);
  }

  function isCombatPlanningPhase() {
    const gameplay = readRecord(state.gameplay);
    return Boolean(
      gameplay &&
        (gameplay.phase === "combat-discussion" || gameplay.phase === "combat-commit") &&
        currentCombat()
    );
  }

  function cardMap() {
    return new Map(
      readArray(readRecord(state.gameplay)?.cards)
        .map(function (entry) {
          const card = readRecord(entry);
          return card ? [readString(card.cardId), card] : null;
        })
        .filter(Boolean)
    );
  }

  function partyActorMap() {
    return new Map(
      readArray(readRecord(state.gameplay)?.partyActors)
        .map(function (entry) {
          const actor = readRecord(entry);
          return actor ? [readString(actor.actorId), actor] : null;
        })
        .filter(Boolean)
    );
  }

  function combatActorMap() {
    return new Map(
      readArray(currentCombat()?.actors)
        .map(function (entry) {
          const actor = readRecord(entry);
          return actor ? [readString(actor.actorId), actor] : null;
        })
        .filter(Boolean)
    );
  }

  function isLocalActive() {
    const discussion = readRecord(state.discussion);
    return Boolean(discussion && readArray(discussion.activeSeatIds).includes("user"));
  }

  function isLocalReady() {
    const discussion = readRecord(state.discussion);
    return Boolean(discussion && readArray(discussion.readySeatIds).includes("user"));
  }

  function canLocalInteract() {
    return isCombatPlanningPhase() && isLocalActive() && !isLocalReady();
  }

  function combatRequestKey(gameplay) {
    const combat = readRecord(gameplay?.combat);
    if (!combat) return "";
    return [
      readString(gameplay.runId),
      String(gameplay.revision ?? ""),
      String(combat.turnIndex ?? ""),
    ].join(":");
  }

  function resolutionRequestKey(gameplay) {
    const combat = readRecord(gameplay?.combat);
    if (
      !combat ||
      gameplay?.phase !== "combat-resolution" ||
      combat.phase !== "combat-resolution"
    ) {
      return "";
    }
    return [
      readString(gameplay.runId),
      String(gameplay.revision ?? ""),
      readString(combat.combatId),
      String(combat.turnIndex ?? ""),
    ].join(":");
  }

  function requestCombatData(gameplay) {
    if (!gameplay || !isCombatPlanningPhase()) return;
    const key = combatRequestKey(gameplay);
    if (!key || key === state.requestedCombatKey) return;
    state.requestedCombatKey = key;
    const runId = readString(gameplay.runId);
    const optionsSent = sendCommand("GameRoomFateKnotsGetCombatOptions", { runId: runId });
    const discussionSent = sendCommand("GameRoomFateKnotsGetCombatDiscussion", { runId: runId });
    if (!optionsSent || !discussionSent) state.requestedCombatKey = "";
  }

  function requestCombatResolution(gameplay) {
    const combat = readRecord(gameplay?.combat);
    const key = resolutionRequestKey(gameplay);
    if (!combat || !key || key === state.requestedResolutionKey) return;
    state.requestedResolutionKey = key;
    const sent = sendCommand("GameRoomFateKnotsResolveCombatTurn", {
      runId: readString(gameplay.runId),
      runRevision: Number(gameplay.revision),
      combatId: readString(combat.combatId),
      turnIndex: Number(combat.turnIndex),
    });
    if (!sent) state.requestedResolutionKey = "";
  }

  function selectedOption(kind) {
    const options = readRecord(state.combatOptions);
    const selectedId = kind === "movement" ? state.movementCardId : state.actionCardId;
    if (!options || !selectedId) return null;
    const list =
      kind === "movement" ? readArray(options.movementOptions) : readArray(options.actionOptions);
    return (
      list.find(function (entry) {
        return readString(readRecord(entry)?.cardId) === selectedId;
      }) || null
    );
  }

  function legalTargetIds() {
    const required = [selectedOption("movement"), selectedOption("action")]
      .map(readRecord)
      .filter(function (option) {
        return option && option.targetRequired === true;
      });

    if (required.length === 0) return [];
    let candidates = readArray(required[0].legalPrimaryTargetIds).map(readString).filter(Boolean);
    required.slice(1).forEach(function (option) {
      const allowed = new Set(
        readArray(option.legalPrimaryTargetIds).map(readString).filter(Boolean)
      );
      candidates = candidates.filter(function (actorId) {
        return allowed.has(actorId);
      });
    });
    return candidates;
  }

  function targetIsRequired() {
    return [selectedOption("movement"), selectedOption("action")].some(function (entry) {
      return readRecord(entry)?.targetRequired === true;
    });
  }

  function normalizeTargetSelection() {
    if (!targetIsRequired()) {
      state.primaryTargetId = null;
      return;
    }
    const targets = legalTargetIds();
    if (state.primaryTargetId && targets.includes(state.primaryTargetId)) return;
    state.primaryTargetId = targets.length === 1 ? targets[0] : null;
  }

  function actorLabel(actorId) {
    const party = partyActorMap().get(actorId);
    if (party) return readString(party.name) || readString(party.seatId) || actorId;
    const combat = currentCombat();
    const opposition = readArray(combat?.actors).filter(function (entry) {
      return readRecord(entry)?.teamId === "opposition";
    });
    const index = opposition.findIndex(function (entry) {
      return readString(readRecord(entry)?.actorId) === actorId;
    });
    return index >= 0 ? `Rakip ${index + 1}` : actorId;
  }

  function renderActorSummary(actor, label) {
    const card = createElement("article", "fate-knots-gameplay__actor");
    const hp = Number(actor.hp ?? 0);
    const maxHp = Number(actor.maxHp ?? 0);
    const position = readRecord(actor.position) || {};
    card.append(
      createElement("strong", "fate-knots-gameplay__actor-name", label),
      createElement("span", "fate-knots-gameplay__actor-hp", `HP ${hp}/${maxHp}`),
      createElement(
        "span",
        "fate-knots-gameplay__actor-meta",
        `${readString(position.row) || "-"} · ${readString(position.range) || "-"}`
      )
    );
    if (actor.fallen === true) card.classList.add("is-fallen");
    return card;
  }

  function renderCombatants() {
    const combat = currentCombat();
    const currentActors = combatActorMap();
    const section = createElement("section", "fate-knots-gameplay__combatants");
    const partyColumn = createElement("div", "fate-knots-gameplay__side");
    partyColumn.append(createElement("h2", "fate-knots-gameplay__side-title", "Grup"));
    readArray(readRecord(state.gameplay)?.partyActors).forEach(function (entry) {
      const partyActor = readRecord(entry);
      if (!partyActor) return;
      const actorId = readString(partyActor.actorId);
      const liveActor = currentActors.get(actorId) || partyActor;
      partyColumn.append(
        renderActorSummary(
          liveActor,
          readString(partyActor.name) || readString(partyActor.seatId) || "Oyuncu"
        )
      );
    });

    const enemyColumn = createElement("div", "fate-knots-gameplay__side");
    enemyColumn.append(createElement("h2", "fate-knots-gameplay__side-title", "Karşı taraf"));
    let enemyIndex = 0;
    readArray(combat?.actors).forEach(function (entry) {
      const actor = readRecord(entry);
      if (!actor || actor.teamId !== "opposition") return;
      enemyIndex += 1;
      enemyColumn.append(renderActorSummary(actor, `Rakip ${enemyIndex}`));
    });
    section.append(partyColumn, enemyColumn);
    return section;
  }

  function renderOptionGroup(title, kind, options) {
    const group = createElement("section", "fate-knots-gameplay__option-group");
    group.append(createElement("h3", "fate-knots-gameplay__option-title", title));
    const row = createElement("div", "fate-knots-gameplay__option-row");
    const selectedId = kind === "movement" ? state.movementCardId : state.actionCardId;
    const locked = !canLocalInteract();
    row.append(
      createButton(
        "Yok",
        function () {
          if (kind === "movement") state.movementCardId = null;
          else state.actionCardId = null;
          normalizeTargetSelection();
          renderCurrent();
        },
        { secondary: true, selected: selectedId === null, disabled: locked }
      )
    );

    const cards = cardMap();
    readArray(options).forEach(function (entry) {
      const option = readRecord(entry);
      if (!option) return;
      const cardId = readString(option.cardId);
      const card = cards.get(cardId);
      const label = card ? readString(card.name) || cardId : cardId;
      row.append(
        createButton(
          label,
          function () {
            if (kind === "movement") state.movementCardId = cardId;
            else state.actionCardId = cardId;
            normalizeTargetSelection();
            renderCurrent();
          },
          { selected: selectedId === cardId, disabled: locked }
        )
      );
    });
    group.append(row);
    return group;
  }

  function renderTargets() {
    if (!targetIsRequired()) return null;
    const group = createElement("section", "fate-knots-gameplay__option-group");
    group.append(createElement("h3", "fate-knots-gameplay__option-title", "Hedef"));
    const targets = legalTargetIds();
    if (targets.length === 0) {
      group.append(
        createElement(
          "div",
          "fate-knots-gameplay__warning",
          "Seçilen hareket ve aksiyon için ortak yasal hedef yok."
        )
      );
      return group;
    }
    const row = createElement("div", "fate-knots-gameplay__option-row");
    targets.forEach(function (actorId) {
      row.append(
        createButton(
          actorLabel(actorId),
          function () {
            state.primaryTargetId = actorId;
            renderCurrent();
          },
          { selected: state.primaryTargetId === actorId, disabled: !canLocalInteract() }
        )
      );
    });
    group.append(row);
    return group;
  }

  function canCompleteMove() {
    if (!canLocalInteract()) return false;
    if (!targetIsRequired()) return true;
    return Boolean(state.primaryTargetId && legalTargetIds().includes(state.primaryTargetId));
  }

  function completeMove() {
    if (!canCompleteMove()) return;
    const payload = { runId: currentRunId() };
    if (state.movementCardId) payload.movementCardId = state.movementCardId;
    if (state.actionCardId) payload.actionCardId = state.actionCardId;
    if (state.primaryTargetId) payload.primaryTargetId = state.primaryTargetId;
    state.lastMessage = "Hamle host tarafından doğrulanıyor…";
    renderCurrent();
    sendCommand("GameRoomFateKnotsCompleteCombatMove", payload);
  }

  function renderPlanningPanel() {
    const panel = createElement("section", "fate-knots-gameplay__planning");
    const options = readRecord(state.combatOptions);
    const discussion = readRecord(state.discussion);
    if (!discussion) {
      panel.append(
        createElement("div", "fate-knots-gameplay__muted", "Savaş oturumu host'tan bekleniyor…")
      );
      return panel;
    }
    if (!isLocalActive()) {
      panel.append(
        createElement(
          "div",
          "fate-knots-gameplay__muted",
          "Local karakter bu tur aktif bir hamle koltuğu değil."
        )
      );
      return panel;
    }
    if (!options) {
      panel.append(
        createElement("div", "fate-knots-gameplay__muted", "Yasal hamleler host'tan bekleniyor…")
      );
      return panel;
    }

    panel.append(
      renderOptionGroup("Hareket", "movement", options.movementOptions),
      renderOptionGroup("Aksiyon", "action", options.actionOptions)
    );
    const targets = renderTargets();
    if (targets) panel.append(targets);

    const footer = createElement("div", "fate-knots-gameplay__planning-footer");
    if (isLocalReady()) {
      footer.append(
        createElement(
          "span",
          "fate-knots-gameplay__ready-note",
          "Hamlen kilitlendi. Diğer oyuncuların tamamlaması bekleniyor."
        )
      );
    } else {
      footer.append(
        createElement(
          "span",
          "fate-knots-gameplay__muted",
          "Hareket ve aksiyon isteğe bağlıdır; seçimlerini Hamleyi tamamla ile kilitle."
        ),
        createButton("Hamleyi tamamla", completeMove, { disabled: !canCompleteMove() })
      );
    }
    panel.append(footer);
    return panel;
  }

  function seatLabel(seatId) {
    if (seatId === "user") return "Sen";
    if (seatId === "ai2") return "AI2";
    if (seatId === "us1") return "US1";
    return seatId;
  }

  function sendChatMessage() {
    const text = state.draftText.trim();
    if (!text || !canLocalInteract()) return;
    state.lastMessage = "";
    sendCommand("GameRoomFateKnotsSendCombatMessage", { runId: currentRunId(), text: text });
  }

  function renderDiscussion() {
    const panel = createElement("section", "fate-knots-gameplay__discussion");
    const heading = createElement("div", "fate-knots-gameplay__discussion-heading");
    heading.append(
      createElement("h3", "fate-knots-gameplay__discussion-title", "Ortak savaş sohbeti")
    );
    const discussion = readRecord(state.discussion);
    const activeSeats = readArray(discussion?.activeSeatIds);
    const readySeats = new Set(readArray(discussion?.readySeatIds));
    const readiness = createElement("div", "fate-knots-gameplay__readiness");
    activeSeats.forEach(function (seatId) {
      const normalized = readString(seatId);
      readiness.append(
        createElement(
          "span",
          readySeats.has(normalized)
            ? "fate-knots-gameplay__seat-state is-ready"
            : "fate-knots-gameplay__seat-state",
          `${seatLabel(normalized)} · ${readySeats.has(normalized) ? "hazır" : "konuşuyor"}`
        )
      );
    });
    heading.append(readiness);
    panel.append(heading);

    if (!discussion) {
      panel.append(
        createElement("div", "fate-knots-gameplay__muted", "Ortak sohbet host'tan bekleniyor…")
      );
      return panel;
    }

    const messages = createElement("div", "fate-knots-gameplay__messages");
    const entries = readArray(discussion.messages);
    if (entries.length === 0) {
      messages.append(createElement("div", "fate-knots-gameplay__muted", "Henüz mesaj yok."));
    } else {
      entries.forEach(function (entry) {
        const message = readRecord(entry);
        if (!message) return;
        const row = createElement("div", "fate-knots-gameplay__message");
        row.append(
          createElement(
            "strong",
            "fate-knots-gameplay__message-author",
            seatLabel(readString(message.seatId))
          ),
          createElement("span", "fate-knots-gameplay__message-text", readString(message.text))
        );
        messages.append(row);
      });
    }
    panel.append(messages);

    if (canLocalInteract()) {
      const compose = createElement("div", "fate-knots-gameplay__compose");
      const input = document.createElement("textarea");
      input.className = "fate-knots-gameplay__chat-input";
      input.rows = 2;
      input.maxLength = 2000;
      input.placeholder = "Gruba bir şey söyle…";
      input.value = state.draftText;
      input.addEventListener("input", function () {
        state.draftText = input.value;
      });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          state.draftText = input.value;
          sendChatMessage();
        }
      });
      compose.append(input, createButton("Gönder", sendChatMessage, { disabled: false }));
      panel.append(compose);
    } else if (isLocalReady()) {
      panel.append(
        createElement(
          "div",
          "fate-knots-gameplay__muted",
          "Hamleni tamamladığın için bu tur mesaj girişin kapandı; ortak konuşma diğer oyuncular bitirene kadar görünür."
        )
      );
    }
    return panel;
  }

  function renderResolvedCards() {
    if (state.lastResolvedCards.length === 0) return null;
    const panel = createElement("section", "fate-knots-gameplay__resolution");
    panel.append(createElement("strong", "fate-knots-gameplay__side-title", "Son çözülen hamleler"));
    const list = createElement("div", "fate-knots-gameplay__option-row");
    state.lastResolvedCards.forEach(function (entry) {
      const resolved = readRecord(entry);
      const card = readRecord(resolved?.card);
      if (!resolved || !card) return;
      const outcome = readString(resolved.outcome);
      const suffix = outcome === "resolved" ? "" : " · boşa çıktı";
      list.append(
        createElement(
          "span",
          "fate-knots-gameplay__seat-state",
          `${readString(card.name) || readString(resolved.cardId)}${suffix}`
        )
      );
    });
    panel.append(list);
    return panel;
  }

  function renderCombat(shell) {
    const combat = currentCombat();
    const turnIndex = Number(combat?.turnIndex ?? 0) + 1;
    shell.append(
      createElement("div", "fate-knots-gameplay__eyebrow", `SAVAŞ · TUR ${turnIndex}`),
      renderCombatants()
    );

    if (isCombatPlanningPhase()) {
      const interaction = createElement("div", "fate-knots-gameplay__interaction");
      interaction.append(renderDiscussion(), renderPlanningPanel());
      shell.append(interaction);
      return;
    }

    shell.append(
      createElement(
        "div",
        "fate-knots-gameplay__resolution",
        readString(combat?.phase) === "combat-resolution"
          ? "Hamleler kilitlendi. Deterministik çözüm uygulanıyor…"
          : "Savaş sonucu işleniyor…"
      )
    );
  }

  function renderExploration(shell) {
    const gameplay = readRecord(state.gameplay) || {};
    const location = readRecord(gameplay.activeLocation);
    shell.append(
      createElement(
        "div",
        "fate-knots-gameplay__eyebrow",
        readString(gameplay.phase).toUpperCase()
      ),
      createElement(
        "h2",
        "fate-knots-gameplay__location",
        readString(location?.name) || "Açık sahne"
      ),
      createElement(
        "p",
        "fate-knots-gameplay__location-copy",
        readString(location?.description) ||
          "Yaşayan kitap sahnesi bir sonraki görsel turda tamamlanacak."
      ),
      createElement(
        "div",
        "fate-knots-gameplay__muted",
        "Bu ilk işlevsel renderer yalnız güvenli gameplay projection'ını gösterir; hikâye seçim yüzeyi henüz eklenmedi."
      )
    );
  }

  function render(root) {
    const gameplay = readRecord(state.gameplay);
    if (!gameplay) return false;
    root.classList.remove("fate-knots-hub-root", "yahtzee-root");
    root.classList.add("fate-knots-gameplay-root");
    root.replaceChildren();

    const shell = createElement("main", "fate-knots-gameplay");
    const header = createElement("header", "fate-knots-gameplay__header");
    const copy = createElement("div");
    copy.append(
      createElement("div", "fate-knots-gameplay__brand", "FATE KNOTS"),
      createElement(
        "h1",
        "fate-knots-gameplay__title",
        readString(readRecord(gameplay.theme)?.name) || "Kader Düğümleri"
      )
    );
    header.append(
      copy,
      createButton(
        "Hub",
        function () {
          sendCommand("GameRoomFateKnotsActivateUniverse", {
            universeId: readString(gameplay.universeId),
          });
        },
        { secondary: true }
      )
    );
    shell.append(header);

    if (currentCombat()) renderCombat(shell);
    else renderExploration(shell);

    const resolvedCards = renderResolvedCards();
    if (resolvedCards) shell.append(resolvedCards);

    if (state.lastMessage) {
      shell.append(createElement("div", "fate-knots-gameplay__notice", state.lastMessage));
    }
    root.append(shell);
    return true;
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root && state.gameplay) render(root);
  }

  function resetCombatInteraction() {
    state.combatOptions = null;
    state.discussion = null;
    state.requestedCombatKey = "";
    state.movementCardId = null;
    state.actionCardId = null;
    state.primaryTargetId = null;
    state.draftText = "";
  }

  function handleState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    if (!payload || !("state" in payload)) return false;
    const previousRunId = currentRunId();
    const nextState = readRecord(payload.state);
    const nextRunId = readString(nextState?.runId);
    if (previousRunId && nextRunId && previousRunId !== nextRunId) {
      state.lastResolvedCards = [];
    }
    state.gameplay = nextState;
    state.lastMessage = "";
    if (!nextState) {
      resetCombatInteraction();
      state.requestedResolutionKey = "";
      state.lastResolvedCards = [];
      return true;
    }

    if (isCombatPlanningPhase()) {
      state.requestedResolutionKey = "";
      requestCombatData(nextState);
    } else {
      resetCombatInteraction();
      if (nextState.phase === "combat-resolution") requestCombatResolution(nextState);
      else state.requestedResolutionKey = "";
    }
    return true;
  }

  function handleCombatDiscussionState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    if (!payload || !("state" in payload)) return false;
    state.discussion = readRecord(payload.state);
    renderCurrent();
    return true;
  }

  function hasIssueCode(result, code) {
    return readArray(result?.issues).some(function (entry) {
      return readString(readRecord(entry)?.code) === code;
    });
  }

  function commandErrorMessage(result) {
    const error = readString(result?.error);
    if (error === "seat-already-committed" || hasIssueCode(result, "seat-already-committed")) {
      return "Bu turdaki hamlen zaten kilitli.";
    }
    if (error === "commit-rejected") {
      return "Seçilen hamle artık yasal değil; seçenekler yenileniyor.";
    }
    if (error === "stale-resolution-request") return "Tur zaten daha yeni bir duruma geçti.";
    if (error === "resolution-failed" || error === "aftermath-failed" || error === "story-exit-failed") {
      return "Deterministik tur çözümü tamamlanamadı.";
    }
    if (error === "wrong-phase") return "Savaş artık hamle hazırlama aşamasında değil.";
    if (error === "persistence-rejected") return "Kayıt durumu güvenli biçimde güncellenemedi.";
    if (error === "no-active-combat") return "Aktif savaş bulunamadı.";
    if (error === "discussion-rejected") return "Ortak savaş sohbeti bu koltuk için kapalı.";
    return "Savaş komutu tamamlanamadı.";
  }

  function handleCommandResult(message) {
    const record = readRecord(message);
    if (!record) return false;
    const command = readString(record.command);
    const result = readRecord(record.result) || {};

    if (command === "GameRoomFateKnotsGetCombatOptions") {
      state.combatOptions = result.ok === true ? readRecord(result.state) : null;
      if (result.ok !== true) {
        state.lastMessage = commandErrorMessage(result);
        state.requestedCombatKey = "";
      }
      normalizeTargetSelection();
      renderCurrent();
      return true;
    }

    if (command === "GameRoomFateKnotsGetCombatDiscussion") {
      state.discussion = result.ok === true ? readRecord(result.state) : null;
      if (result.ok !== true) {
        state.lastMessage = commandErrorMessage(result);
        state.requestedCombatKey = "";
      }
      renderCurrent();
      return true;
    }

    if (command === "GameRoomFateKnotsSendCombatMessage") {
      if (result.ok === true) {
        state.discussion = readRecord(result.state);
        state.draftText = "";
        state.lastMessage = "";
      } else {
        state.lastMessage = commandErrorMessage(result);
      }
      renderCurrent();
      return true;
    }

    if (command === "GameRoomFateKnotsCompleteCombatMove") {
      state.lastMessage = result.ok === true ? "Hamlen kilitlendi." : commandErrorMessage(result);
      if (result.ok !== true) {
        state.requestedCombatKey = "";
        requestCombatData(readRecord(state.gameplay));
      }
      renderCurrent();
      return true;
    }

    if (command === "GameRoomFateKnotsResolveCombatTurn") {
      state.requestedResolutionKey = "";
      if (result.ok === true) {
        const resolutionState = readRecord(result.state);
        state.lastResolvedCards = readArray(resolutionState?.cards);
        state.lastMessage = "Tur deterministik olarak çözüldü.";
      } else {
        state.lastMessage = commandErrorMessage(result);
      }
      renderCurrent();
      return true;
    }

    return false;
  }

  function hasGameplayState() {
    return Boolean(state.gameplay);
  }

  function dispose() {
    const root = document.getElementById("app");
    if (root) root.classList.remove("fate-knots-gameplay-root");
    state.gameplay = null;
    resetCombatInteraction();
    state.requestedResolutionKey = "";
    state.lastResolvedCards = [];
    state.lastMessage = "";
  }

  global.GameRoomFateKnotsGameplayUi = {
    dispose: dispose,
    handleCommandResult: handleCommandResult,
    handleCombatDiscussionState: handleCombatDiscussionState,
    handleState: handleState,
    hasGameplayState: hasGameplayState,
    render: render,
  };
})(window);
