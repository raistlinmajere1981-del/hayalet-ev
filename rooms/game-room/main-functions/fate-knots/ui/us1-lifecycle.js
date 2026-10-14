/* global window, document, Element */

(function (global) {
  const hubUi = global.GameRoomFateKnotsUi;
  const state = {
    mirror: null,
    setupUniverseId: null,
    lastMirrorKey: "",
    movementCardId: null,
    actionCardId: null,
    primaryTargetId: null,
    lootDraft: new Map(),
    lootDraftTouched: false,
    lootProposalRevision: -1,
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
      state.lastMessage = "Komut uzak World Host'a gönderilemedi.";
      renderCurrent();
      return false;
    }
    state.lastMessage = "World Host yanıtı bekleniyor…";
    renderCurrent();
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
    if (options && options.secondary)
      button.classList.add("fate-knots-gameplay__button--secondary");
    if (options && options.selected) button.classList.add("is-selected");
    if (options && options.disabled) button.disabled = true;
    if (!button.disabled && typeof onClick === "function") button.addEventListener("click", onClick);
    return button;
  }

  function mirrorKey(mirror) {
    const record = readRecord(mirror);
    if (!record) return "";
    if (record.kind === "setup") return `setup:${readString(record.universeId)}`;
    return [
      readString(record.runId),
      String(record.runRevision ?? ""),
      readString(record.phase),
      readString(record.result),
    ].join(":");
  }

  function syncMirrorLocalState(mirror) {
    const key = mirrorKey(mirror);
    if (key !== state.lastMirrorKey) {
      state.lastMirrorKey = key;
      state.movementCardId = null;
      state.actionCardId = null;
      state.primaryTargetId = null;
      state.lootDraft = new Map();
      state.lootDraftTouched = false;
      state.lootProposalRevision = -1;
    }

    const loot = readRecord(readRecord(mirror)?.loot);
    if (!loot) return;
    const revision = Number(loot.proposalRevision ?? -1);
    if (revision !== state.lootProposalRevision && !state.lootDraftTouched) {
      state.lootProposalRevision = revision;
      state.lootDraft = new Map();
      readArray(loot.allocations).forEach(function (entry) {
        const allocation = readRecord(entry);
        if (!allocation || !Number.isInteger(allocation.poolIndex)) return;
        state.lootDraft.set(allocation.poolIndex, allocation.recipientActorId ?? null);
      });
    }
  }

  function gameplay() {
    return readRecord(readRecord(state.mirror)?.gameplay);
  }

  function cardMap() {
    return new Map(
      readArray(gameplay()?.cards)
        .map(function (entry) {
          const card = readRecord(entry);
          return card ? [readString(card.cardId), card] : null;
        })
        .filter(Boolean)
    );
  }

  function partyActors() {
    return readArray(gameplay()?.partyActors).map(readRecord).filter(Boolean);
  }

  function us1Actor() {
    return partyActors().find(function (actor) {
      return actor.seatId === "us1";
    }) || null;
  }

  function actorLabel(actorId) {
    const party = partyActors().find(function (actor) {
      return readString(actor.actorId) === actorId;
    });
    if (party) return readString(party.name) || readString(party.seatId) || actorId;
    const combat = readRecord(gameplay()?.combat);
    const opposition = readArray(combat?.actors).map(readRecord).filter(function (actor) {
      return actor && actor.teamId === "opposition";
    });
    const index = opposition.findIndex(function (actor) {
      return readString(actor.actorId) === actorId;
    });
    return index >= 0 ? `Rakip ${index + 1}` : actorId;
  }

  function renderParty() {
    const section = createElement("section", "fate-knots-gameplay__combatants");
    const column = createElement("div", "fate-knots-gameplay__side");
    column.append(createElement("h2", "fate-knots-gameplay__side-title", "Grup"));
    partyActors().forEach(function (actor) {
      const position = readRecord(actor.position) || {};
      const card = createElement("article", "fate-knots-gameplay__actor");
      card.append(
        createElement(
          "strong",
          "fate-knots-gameplay__actor-name",
          `${readString(actor.name) || readString(actor.seatId) || "Oyuncu"}${actor.seatId === "us1" ? " · Sen" : ""}`
        ),
        createElement(
          "span",
          "fate-knots-gameplay__actor-hp",
          `HP ${String(actor.hp ?? 0)}/${String(actor.maxHp ?? 0)}`
        ),
        createElement(
          "span",
          "fate-knots-gameplay__actor-meta",
          `${readString(position.row) || "-"} · ${readString(position.range) || "-"}`
        )
      );
      if (actor.fallen === true) card.classList.add("is-fallen");
      column.append(card);
    });
    section.append(column);
    return section;
  }

  function renderSetup(mirror) {
    const setup = readRecord(mirror.setup);
    const seats = readRecord(mirror.seats);
    const selections = readRecord(seats?.selections) || {};
    const selectedUs1 = readString(selections.us1);
    const occupied = new Set([readString(selections.user), readString(selections.ai2)].filter(Boolean));
    const panel = createElement("section", "fate-knots-hub__setup");
    panel.append(
      createElement("div", "fate-knots-hub__eyebrow", "US1 · RUN SETUP"),
      createElement("h2", "fate-knots-hub__setup-title", readString(setup?.title) || "Fate Knots"),
      createElement(
        "p",
        "fate-knots-hub__setup-copy",
        "Bu koşuda kendi karakterini yalnız sen seçersin. Diğer oyuncuların seçtiği karakterler kullanılamaz."
      )
    );

    const grid = createElement("div", "fate-knots-hub__character-grid");
    readArray(setup?.characters).forEach(function (entry) {
      const character = readRecord(entry);
      if (!character) return;
      const characterId = readString(character.characterId);
      const stats = readRecord(character.baseStats) || {};
      const selected = selectedUs1 === characterId;
      const button = createButton(
        readString(character.name) || characterId,
        function () {
          sendCommand("GameRoomFateKnotsUs1ClientSelectCharacter", {
            characterId: selected ? null : characterId,
          });
        },
        { selected: selected, disabled: !selected && occupied.has(characterId) }
      );
      button.classList.add("fate-knots-hub__character-choice");
      button.append(
        createElement(
          "span",
          "fate-knots-hub__character-meta",
          `HP ${String(stats.maxHp ?? "-")} · ATK ${String(stats.attack ?? "-")} · DEF ${String(stats.defense ?? "-")} · SPD ${String(stats.speed ?? "-")} · ENG ${String(stats.energy ?? "-")}`
        )
      );
      grid.append(button);
    });
    panel.append(grid);
    panel.append(
      createElement(
        "div",
        "fate-knots-hub__setup-note",
        selectedUs1 ? "Seçimin World Host'a ulaştı. Koşunun hazırlanması bekleniyor." : "Bir karakter seç."
      )
    );
    return panel;
  }

  function renderMessages(messages) {
    const list = createElement("div", "fate-knots-gameplay__discussion-list");
    readArray(messages).forEach(function (entry) {
      const message = readRecord(entry);
      if (!message) return;
      list.append(
        createElement(
          "div",
          "fate-knots-gameplay__discussion-message",
          `${readString(message.seatId).toUpperCase()}: ${readString(message.text)}`
        )
      );
    });
    return list;
  }

  function renderTextComposer(commandName, placeholder) {
    const row = createElement("div", "fate-knots-gameplay__discussion-compose");
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 2000;
    input.placeholder = placeholder;
    const send = createButton("Gönder", function () {
      const text = input.value.trim();
      if (!text) return;
      if (sendCommand(commandName, { text: text })) input.value = "";
    });
    row.append(input, send);
    return row;
  }

  function renderNpcPanel() {
    const npcs = readArray(gameplay()?.visibleNpcs).map(readRecord).filter(Boolean);
    if (npcs.length === 0) return null;
    const panel = createElement("section", "fate-knots-gameplay__planning");
    panel.append(createElement("h3", "fate-knots-gameplay__option-title", "Konuşulabilir kişiler"));
    npcs.forEach(function (npc) {
      const row = createElement("div", "fate-knots-gameplay__discussion-compose");
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 2000;
      input.placeholder = `${readString(npc.name) || "NPC"} ile konuş…`;
      row.append(
        createElement("strong", "fate-knots-gameplay__actor-name", readString(npc.name) || "NPC"),
        input,
        createButton("Konuş", function () {
          const text = input.value.trim();
          if (!text) return;
          if (
            sendCommand("GameRoomFateKnotsUs1ClientSpeakNpc", {
              npcId: readString(npc.npcId),
              text: text,
            })
          ) {
            input.value = "";
          }
        })
      );
      panel.append(row);
    });
    const last = readRecord(readRecord(state.mirror)?.lastNpcDialogue);
    if (last && readString(last.utterance)) {
      panel.append(
        createElement(
          "div",
          "fate-knots-gameplay__discussion-message",
          `Yanıt: ${readString(last.utterance)}`
        )
      );
    }
    return panel;
  }

  function renderExploration(mirror) {
    const consensus = readRecord(mirror.exploration);
    const panel = createElement("section", "fate-knots-gameplay__planning");
    panel.append(createElement("h2", "fate-knots-gameplay__side-title", "Ortak karar"));
    if (!consensus) {
      panel.append(createElement("div", "fate-knots-gameplay__muted", "Karar durumu bekleniyor…"));
      return panel;
    }
    panel.append(renderMessages(consensus.messages));
    panel.append(
      renderTextComposer(
        "GameRoomFateKnotsUs1ClientSendExplorationMessage",
        "Gruba mesaj yaz…"
      )
    );

    const choices = new Map(
      readArray(consensus.choices)
        .map(function (entry) {
          const choice = readRecord(entry);
          return choice ? [readString(choice.seatId), choice.transitionId ?? null] : null;
        })
        .filter(Boolean)
    );
    const current = choices.get("us1") ?? null;
    const row = createElement("div", "fate-knots-gameplay__option-row");
    readArray(consensus.availableTransitions).forEach(function (entry) {
      const transition = readRecord(entry);
      if (!transition) return;
      const transitionId = readString(transition.id);
      row.append(
        createButton(
          readString(transition.label) || transitionId,
          function () {
            sendCommand("GameRoomFateKnotsUs1ClientChooseExploration", {
              transitionId: current === transitionId ? null : transitionId,
            });
          },
          { selected: current === transitionId }
        )
      );
    });
    panel.append(row);

    const publicChoices = readArray(consensus.choices)
      .map(function (entry) {
        const choice = readRecord(entry);
        return choice
          ? `${readString(choice.seatId).toUpperCase()}: ${readString(choice.transitionId) || "—"}`
          : "";
      })
      .filter(Boolean)
      .join(" · ");
    panel.append(createElement("div", "fate-knots-gameplay__muted", publicChoices));
    return panel;
  }

  function selectedCombatOption(options, kind) {
    const selectedId = kind === "movement" ? state.movementCardId : state.actionCardId;
    if (!selectedId) return null;
    const list = kind === "movement" ? readArray(options.movementOptions) : readArray(options.actionOptions);
    return list.find(function (entry) {
      return readString(readRecord(entry)?.cardId) === selectedId;
    }) || null;
  }

  function legalTargetIds(options) {
    const required = [selectedCombatOption(options, "movement"), selectedCombatOption(options, "action")]
      .map(readRecord)
      .filter(function (option) {
        return option && option.targetRequired === true;
      });
    if (required.length === 0) return [];
    let candidates = readArray(required[0].legalPrimaryTargetIds).map(readString).filter(Boolean);
    required.slice(1).forEach(function (option) {
      const allowed = new Set(readArray(option.legalPrimaryTargetIds).map(readString).filter(Boolean));
      candidates = candidates.filter(function (actorId) {
        return allowed.has(actorId);
      });
    });
    return candidates;
  }

  function targetRequired(options) {
    return [selectedCombatOption(options, "movement"), selectedCombatOption(options, "action")].some(
      function (entry) {
        return readRecord(entry)?.targetRequired === true;
      }
    );
  }

  function normalizeCombatTarget(options) {
    if (!targetRequired(options)) {
      state.primaryTargetId = null;
      return;
    }
    const targets = legalTargetIds(options);
    if (state.primaryTargetId && targets.includes(state.primaryTargetId)) return;
    state.primaryTargetId = targets.length === 1 ? targets[0] : null;
  }

  function renderCombatOptionGroup(title, kind, options, locked) {
    const group = createElement("section", "fate-knots-gameplay__option-group");
    group.append(createElement("h3", "fate-knots-gameplay__option-title", title));
    const row = createElement("div", "fate-knots-gameplay__option-row");
    const selectedId = kind === "movement" ? state.movementCardId : state.actionCardId;
    row.append(
      createButton(
        "Yok",
        function () {
          if (kind === "movement") state.movementCardId = null;
          else state.actionCardId = null;
          normalizeCombatTarget(options);
          renderCurrent();
        },
        { secondary: true, selected: selectedId === null, disabled: locked }
      )
    );
    const cards = cardMap();
    readArray(kind === "movement" ? options.movementOptions : options.actionOptions).forEach(
      function (entry) {
        const option = readRecord(entry);
        if (!option) return;
        const cardId = readString(option.cardId);
        const card = cards.get(cardId);
        row.append(
          createButton(
            card ? readString(card.name) || cardId : cardId,
            function () {
              if (kind === "movement") state.movementCardId = cardId;
              else state.actionCardId = cardId;
              normalizeCombatTarget(options);
              renderCurrent();
            },
            { selected: selectedId === cardId, disabled: locked }
          )
        );
      }
    );
    group.append(row);
    return group;
  }

  function renderCombat(mirror) {
    const combatMirror = readRecord(mirror.combat);
    const panel = createElement("section", "fate-knots-gameplay__planning");
    panel.append(createElement("h2", "fate-knots-gameplay__side-title", "Savaş kararı"));
    if (!combatMirror) {
      panel.append(
        createElement(
          "div",
          "fate-knots-gameplay__muted",
          "World Host savaş çözümlemesini yürütüyor…"
        )
      );
      return panel;
    }
    const options = readRecord(combatMirror.options) || {};
    const discussion = readRecord(combatMirror.discussion) || {};
    panel.append(renderMessages(discussion.messages));
    panel.append(
      renderTextComposer("GameRoomFateKnotsUs1ClientSendCombatMessage", "Savaş planına mesaj yaz…")
    );

    const active = readArray(discussion.activeSeatIds).includes("us1");
    const ready = readArray(discussion.readySeatIds).includes("us1");
    if (!active) {
      panel.append(createElement("div", "fate-knots-gameplay__muted", "Bu tur aktif değilsin."));
      return panel;
    }
    if (ready) {
      panel.append(
        createElement(
          "div",
          "fate-knots-gameplay__ready-note",
          "Hamlen kilitlendi. Diğer oyuncular ve World Host çözümlemesi bekleniyor."
        )
      );
      return panel;
    }

    panel.append(
      renderCombatOptionGroup("Hareket", "movement", options, false),
      renderCombatOptionGroup("Aksiyon", "action", options, false)
    );
    if (targetRequired(options)) {
      const targets = legalTargetIds(options);
      const group = createElement("section", "fate-knots-gameplay__option-group");
      group.append(createElement("h3", "fate-knots-gameplay__option-title", "Hedef"));
      const row = createElement("div", "fate-knots-gameplay__option-row");
      targets.forEach(function (actorId) {
        row.append(
          createButton(
            actorLabel(actorId),
            function () {
              state.primaryTargetId = actorId;
              renderCurrent();
            },
            { selected: state.primaryTargetId === actorId }
          )
        );
      });
      group.append(row);
      panel.append(group);
    }

    const canCommit =
      !targetRequired(options) ||
      Boolean(state.primaryTargetId && legalTargetIds(options).includes(state.primaryTargetId));
    panel.append(
      createButton(
        "Hamleyi kilitle",
        function () {
          sendCommand("GameRoomFateKnotsUs1ClientCompleteCombatMove", {
            movementCardId: state.movementCardId,
            actionCardId: state.actionCardId,
            primaryTargetId: state.primaryTargetId,
          });
        },
        { disabled: !canCommit }
      )
    );
    return panel;
  }

  function lootCardLabel(cardId) {
    const card = cardMap().get(cardId);
    return card ? readString(card.name) || cardId : cardId;
  }

  function renderLoot(mirror) {
    const loot = readRecord(mirror.loot);
    const panel = createElement("section", "fate-knots-gameplay__planning");
    panel.append(createElement("h2", "fate-knots-gameplay__side-title", "Ganimet paylaşımı"));
    if (!loot) {
      panel.append(createElement("div", "fate-knots-gameplay__muted", "Ganimet durumu bekleniyor…"));
      return panel;
    }

    const proposalByIndex = new Map(
      readArray(loot.allocations)
        .map(function (entry) {
          const allocation = readRecord(entry);
          return allocation ? [allocation.poolIndex, allocation.recipientActorId ?? null] : null;
        })
        .filter(Boolean)
    );

    readArray(loot.pool).forEach(function (entry) {
      const item = readRecord(entry);
      if (!item || !Number.isInteger(item.poolIndex)) return;
      const poolIndex = item.poolIndex;
      const cardId = readString(item.cardId);
      const group = createElement("section", "fate-knots-gameplay__option-group");
      group.append(createElement("h3", "fate-knots-gameplay__option-title", lootCardLabel(cardId)));
      const row = createElement("div", "fate-knots-gameplay__option-row");
      partyActors().forEach(function (actor) {
        const actorId = readString(actor.actorId);
        row.append(
          createButton(
            readString(actor.name) || readString(actor.seatId) || actorId,
            function () {
              state.lootDraft.set(poolIndex, actorId);
              state.lootDraftTouched = true;
              renderCurrent();
            },
            { selected: state.lootDraft.has(poolIndex) && state.lootDraft.get(poolIndex) === actorId }
          )
        );
      });
      row.append(
        createButton(
          "Geride bırak",
          function () {
            state.lootDraft.set(poolIndex, null);
            state.lootDraftTouched = true;
            renderCurrent();
          },
          { secondary: true, selected: state.lootDraft.has(poolIndex) && state.lootDraft.get(poolIndex) === null }
        )
      );
      group.append(row);
      const proposedRecipient = proposalByIndex.get(poolIndex);
      if (proposalByIndex.has(poolIndex)) {
        group.append(
          createElement(
            "div",
            "fate-knots-gameplay__muted",
            `Mevcut öneri: ${proposedRecipient ? actorLabel(readString(proposedRecipient)) : "Geride bırak"}`
          )
        );
      }
      panel.append(group);
    });

    const pool = readArray(loot.pool);
    const draftComplete = pool.every(function (entry) {
      const item = readRecord(entry);
      return item && Number.isInteger(item.poolIndex) && state.lootDraft.has(item.poolIndex);
    });
    panel.append(
      createButton(
        "Bu dağıtımı öner",
        function () {
          const allocations = pool.map(function (entry) {
            const item = readRecord(entry);
            return {
              poolIndex: item.poolIndex,
              recipientActorId: state.lootDraft.get(item.poolIndex) ?? null,
            };
          });
          if (sendCommand("GameRoomFateKnotsUs1ClientProposeLoot", { allocations: allocations })) {
            state.lootDraftTouched = false;
          }
        },
        { disabled: !draftComplete }
      )
    );

    const approvals = readArray(loot.approvedSeatIds).map(readString);
    if (readArray(loot.allocations).length > 0) {
      panel.append(
        createButton(
          approvals.includes("us1") ? "Onaylandı" : "Mevcut öneriyi onayla",
          function () {
            sendCommand("GameRoomFateKnotsUs1ClientApproveLoot", {});
          },
          { secondary: true, disabled: approvals.includes("us1") }
        )
      );
    }
    panel.append(
      createElement(
        "div",
        "fate-knots-gameplay__muted",
        `Onaylar: ${approvals.length > 0 ? approvals.join(", ") : "henüz yok"}`
      )
    );
    return panel;
  }

  function renderCamp(mirror) {
    const camp = readRecord(mirror.camp);
    const panel = createElement("section", "fate-knots-gameplay__planning");
    panel.append(createElement("h2", "fate-knots-gameplay__side-title", "Kamp"));
    if (!camp) {
      panel.append(createElement("div", "fate-knots-gameplay__muted", "Kamp durumu bekleniyor…"));
      return panel;
    }
    const actor = us1Actor();
    if (actor) {
      const equipmentDefs = new Map(
        readArray(gameplay()?.equipment)
          .map(function (entry) {
            const equipment = readRecord(entry);
            return equipment ? [readString(equipment.equipmentId), equipment] : null;
          })
          .filter(Boolean)
      );
      const ownedCards = new Set(readArray(actor.ownedCardIds).map(readString));
      const ownedEquipmentIds = readArray(gameplay()?.cards)
        .map(readRecord)
        .filter(function (card) {
          return card && card.kind === "equipment" && ownedCards.has(readString(card.cardId));
        })
        .map(function (card) {
          return readString(card.sourceId);
        })
        .filter(Boolean);
      const slots = new Set(
        ownedEquipmentIds
          .map(function (equipmentId) {
            return readString(equipmentDefs.get(equipmentId)?.slot);
          })
          .filter(Boolean)
      );
      slots.forEach(function (slot) {
        const group = createElement("section", "fate-knots-gameplay__option-group");
        group.append(createElement("h3", "fate-knots-gameplay__option-title", slot));
        const row = createElement("div", "fate-knots-gameplay__option-row");
        const currentId = readArray(actor.equipmentIds).find(function (equipmentId) {
          return readString(equipmentDefs.get(readString(equipmentId))?.slot) === slot;
        }) || null;
        row.append(
          createButton(
            "Boş",
            function () {
              sendCommand("GameRoomFateKnotsUs1ClientSetCampEquipment", {
                slot: slot,
                equipmentId: null,
              });
            },
            { secondary: true, selected: !currentId }
          )
        );
        ownedEquipmentIds.forEach(function (equipmentId) {
          const definition = equipmentDefs.get(equipmentId);
          if (!definition || readString(definition.slot) !== slot) return;
          row.append(
            createButton(
              readString(definition.name) || equipmentId,
              function () {
                sendCommand("GameRoomFateKnotsUs1ClientSetCampEquipment", {
                  slot: slot,
                  equipmentId: equipmentId,
                });
              },
              { selected: currentId === equipmentId }
            )
          );
        });
        group.append(row);
        panel.append(group);
      });
    }

    const ready = readArray(camp.readySeatIds).map(readString);
    panel.append(
      createButton(
        ready.includes("us1") ? "Hazırsın" : "Kamptan ayrılmaya hazırım",
        function () {
          sendCommand("GameRoomFateKnotsUs1ClientReadyCamp", {});
        },
        { disabled: ready.includes("us1") }
      ),
      createElement(
        "div",
        "fate-knots-gameplay__muted",
        `Hazır koltuklar: ${ready.length > 0 ? ready.join(", ") : "henüz yok"}`
      )
    );
    return panel;
  }

  function renderRun(mirror) {
    const shell = createElement("main", "fate-knots-gameplay");
    const header = createElement("header", "fate-knots-gameplay__header");
    const location = readRecord(gameplay()?.activeLocation);
    header.append(
      createElement("div", "fate-knots-gameplay__eyebrow", "FATE KNOTS · US1 REMOTE PLAYER"),
      createElement(
        "h1",
        "fate-knots-gameplay__title",
        readString(location?.name) || "World Host oturumu"
      ),
      createElement(
        "p",
        "fate-knots-gameplay__subtitle",
        `${readString(mirror.phase)} · revizyon ${String(mirror.runRevision ?? 0)}`
      )
    );
    shell.append(header, renderParty());

    if (mirror.result !== "active") {
      shell.append(
        createElement(
          "section",
          "fate-knots-gameplay__planning",
          mirror.result === "completed" ? "Koşu tamamlandı." : "Koşu sona erdi."
        )
      );
      return shell;
    }

    if (mirror.phase === "exploration") {
      shell.append(renderExploration(mirror));
      const npcPanel = renderNpcPanel();
      if (npcPanel) shell.append(npcPanel);
    } else if (mirror.phase === "combat-discussion" || mirror.phase === "combat-commit") {
      shell.append(renderCombat(mirror));
    } else if (mirror.phase === "loot") {
      shell.append(renderLoot(mirror));
    } else if (mirror.phase === "camp") {
      shell.append(renderCamp(mirror));
    } else {
      shell.append(
        createElement(
          "section",
          "fate-knots-gameplay__planning",
          mirror.phase === "run-setup"
            ? "World Host koşuyu başlatana kadar bekleniyor."
            : "World Host mekanik çözümlemeyi tamamlıyor…"
        )
      );
    }
    return shell;
  }

  function render(root) {
    const mirror = readRecord(state.mirror);
    if (!mirror) return;
    root.classList.remove("yahtzee-root");
    root.classList.remove("fate-knots-hub-root");
    root.classList.add("fate-knots-gameplay-root");
    root.replaceChildren();

    const content = mirror.kind === "setup" ? renderSetup(mirror) : renderRun(mirror);
    if (mirror.kind === "setup") {
      const shell = createElement("main", "fate-knots-hub");
      shell.append(content);
      if (state.lastMessage) shell.append(createElement("div", "fate-knots-hub__message", state.lastMessage));
      root.append(shell);
      return;
    }
    if (state.lastMessage) {
      content.append(createElement("div", "fate-knots-gameplay__muted", state.lastMessage));
    }
    root.append(content);
  }

  function renderCurrent() {
    const root = document.getElementById("app");
    if (root && state.mirror) render(root);
  }

  function handleState(message) {
    const record = readRecord(message);
    const payload = record ? readRecord(record.payload) : null;
    const next = payload ? readRecord(payload.state) : null;
    state.mirror = next;
    state.lastMessage = "";
    if (next) syncMirrorLocalState(next);
    else state.lastMirrorKey = "";
    return true;
  }

  function handleCommandResult(message) {
    const record = readRecord(message);
    if (!record) return false;
    const command = readString(record.command);
    if (!command.startsWith("GameRoomFateKnotsUs1Client")) return false;
    const result = readRecord(record.result) || {};
    state.lastMessage =
      result.ok === true
        ? "İstek World Host'a iletildi. Yeni senkron bekleniyor…"
        : "Uzak oyuncu isteği tamamlanamadı.";
    return true;
  }

  function hasMirrorState() {
    return Boolean(state.mirror);
  }

  function dispose() {
    const root = document.getElementById("app");
    if (root) root.classList.remove("fate-knots-gameplay-root");
  }

  if (hubUi && typeof hubUi.handleCommandResult === "function") {
    const baseHandleCommandResult = hubUi.handleCommandResult;
    hubUi.handleCommandResult = function handleUs1SetupLifecycleResult(message) {
      const record = readRecord(message);
      const command = record ? readString(record.command) : "";
      const result = record ? readRecord(record.result) : null;
      if (command === "GameRoomFateKnotsGetRunSetup" && result?.ok === true) {
        const setup = readRecord(result.setup);
        state.setupUniverseId = setup ? readString(setup.universeId) || null : null;
      } else if (command === "GameRoomFateKnotsCreateRun" && result?.ok === true) {
        state.setupUniverseId = null;
      }
      return baseHandleCommandResult(message);
    };
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button.fate-knots-hub__button");
    if (!button || !state.setupUniverseId) return;
    const label = button.textContent?.trim();
    if (label !== "Kat" && label !== "Çıkar") return;
    const seat = button.closest(".fate-knots-hub__seat");
    const title = seat?.querySelector(".fate-knots-hub__seat-title")?.textContent?.trim();
    if (title !== "US1") return;
    const roomApi = global.roomAPI;
    if (!roomApi || typeof roomApi.sendCommand !== "function") return;
    roomApi.sendCommand(
      label === "Kat"
        ? "GameRoomFateKnotsRequestUs1RunCharacter"
        : "GameRoomFateKnotsCancelUs1RunCharacter",
      { universeId: state.setupUniverseId }
    );
  });

  global.GameRoomFateKnotsUs1MirrorUi = {
    dispose: dispose,
    handleCommandResult: handleCommandResult,
    handleState: handleState,
    hasMirrorState: hasMirrorState,
    render: render,
  };
})(window);
