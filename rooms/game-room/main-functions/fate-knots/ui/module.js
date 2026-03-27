(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiModule = function createFateKnotsUiModule(deps) {
    const getState = deps.getState;
    const featureId = deps.featureId || "fate-knots";
    const createElement = deps.createElement;
    const sendRoomCommand = deps.sendRoomCommand;
    const getFeatureLabel = deps.getFeatureLabel;
    const text = deps.text;

    function t(path, fallback) {
      const resolved = text(path);
      return resolved === path.join(".") ? fallback : resolved;
    }

    function cloneJsonValue(value) {
      return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    function createDefaultAsset(assetId) {
      return {
        assetId: assetId || null,
        asset: {
          id: assetId || "",
          uiSrc: null,
          src: null,
        },
        uiSrc: null,
        src: null,
      };
    }

    function createDefaultSelection() {
      return {
        avatarId: null,
        classId: null,
        backgroundId: null,
        locked: false,
        autoAssigned: false,
        avatar: null,
        class: null,
        background: null,
      };
    }

    function createDefaultParticipant(seatId) {
      return {
        seatId: seatId || "user",
        provider: seatId || "user",
        type: seatId === "user" ? "local-user" : "ai",
        nickname: seatId === "user" ? "User" : (seatId || "seat").toUpperCase(),
        ready: seatId === "user",
        connected: true,
        active: true,
        selection: createDefaultSelection(),
        decisionChoiceId: null,
        combat: null,
      };
    }

    function createDefaultCatalogEntry() {
      return {
        id: "",
        label: "",
        summary: "",
        description: "",
        perk: "",
        stats: null,
        startingDeck: [],
        assetId: null,
        asset: null,
        uiSrc: null,
        src: null,
      };
    }

    function createDefaultChoice() {
      return {
        id: "",
        label: "",
        summary: "",
        nextStepId: null,
        encounterId: null,
      };
    }

    function createDefaultResult() {
      return {
        outcome: "idle",
        title: "",
        summary: "",
        continueHint: "",
      };
    }

    function createDefaultProfile() {
      return {
        avatarId: null,
        classId: null,
        backgroundId: null,
        updatedAt: null,
      };
    }

    function createDefaultSaveSlot() {
      return {
        hasResumeData: false,
        lastCompletedSessionId: null,
        lastOutcome: null,
        updatedAt: null,
      };
    }

    function createDefaultAmbientPacket(kind) {
      return {
        kind: kind || "dm",
        seatId: null,
        phase: null,
        text: "",
        stepId: null,
        encounterId: null,
        turnId: null,
        updatedAt: null,
      };
    }

    function createDefaultTransport() {
      return {
        localSessionId: null,
        remoteUserId: null,
      };
    }

    function createFateKnotsState() {
      return {
        roomId: "game-room",
        featureId: featureId,
        schemaVersion: 1,
        active: false,
        phase: "idle",
        statusKey: "idle",
        status: "",
        compatibility: {
          mode: "fresh",
          reason: "",
        },
        sessionId: null,
        participantMode: "user-plus-ready-ai",
        rosterLocked: false,
        participants: [createDefaultParticipant("user")],
        excludedSeats: [],
        waiting: {
          mode: "idle",
          reason: "",
          pendingSeatIds: [],
          deadlineAt: null,
        },
        map: {
          mapAsset: createDefaultAsset("map_scenario_01"),
          nodes: [],
          currentLocationId: null,
        },
        currentStep: null,
        decision: null,
        combat: null,
        result: createDefaultResult(),
        dmNarration: null,
        npcBanter: null,
        profile: createDefaultProfile(),
        history: [],
        saveSlot: createDefaultSaveSlot(),
        scenarioLog: [],
        catalogs: {
          avatars: [],
          classes: [],
          backgrounds: [],
        },
        assetCoverage: {},
        contentErrors: [],
        contentSummary: {
          assetErrors: 0,
          sourceErrors: 0,
        },
        user: {
          nickname: "User",
        },
        transport: createDefaultTransport(),
        uiAssets: {
          featureView: null,
        },
      };
    }

    function sanitizeAssetLink(candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return createDefaultAsset(null);
      }
      const nested =
        candidate.asset &&
        typeof candidate.asset === "object" &&
        Array.isArray(candidate.asset) === false
          ? candidate.asset
          : {};
      const assetId =
        typeof candidate.assetId === "string"
          ? candidate.assetId
          : typeof nested.id === "string"
            ? nested.id
            : null;
      const uiSrc =
        typeof candidate.uiSrc === "string"
          ? candidate.uiSrc
          : typeof nested.uiSrc === "string"
            ? nested.uiSrc
            : null;
      const src =
        typeof candidate.src === "string"
          ? candidate.src
          : typeof nested.src === "string"
            ? nested.src
            : null;
      return {
        assetId: assetId,
        asset: {
          id: assetId || "",
          uiSrc: uiSrc,
          src: src,
        },
        uiSrc: uiSrc,
        src: src,
      };
    }

    function sanitizeCatalogEntry(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : {};
      const next = createDefaultCatalogEntry();
      const asset = sanitizeAssetLink(source.asset || source);
      next.id = typeof source.id === "string" ? source.id : "";
      next.label = typeof source.label === "string" ? source.label : next.id;
      next.summary = typeof source.summary === "string" ? source.summary : "";
      next.description = typeof source.description === "string" ? source.description : "";
      next.perk = typeof source.perk === "string" ? source.perk : "";
      next.stats =
        source.stats && typeof source.stats === "object" && Array.isArray(source.stats) === false
          ? cloneJsonValue(source.stats)
          : null;
      next.startingDeck = Array.isArray(source.startingDeck)
        ? source.startingDeck.filter(function (entry) {
            return typeof entry === "string" && entry.trim() !== "";
          })
        : [];
      next.assetId = typeof source.assetId === "string" ? source.assetId : asset.assetId;
      next.asset = next.assetId || asset.uiSrc || asset.src ? asset : null;
      next.uiSrc = asset.uiSrc;
      next.src = asset.src;
      return next;
    }

    function sanitizeChoice(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : {};
      const next = createDefaultChoice();
      next.id = typeof source.id === "string" ? source.id : "";
      next.label = typeof source.label === "string" ? source.label : next.id;
      next.summary = typeof source.summary === "string" ? source.summary : "";
      next.nextStepId = typeof source.nextStepId === "string" ? source.nextStepId : null;
      next.encounterId = typeof source.encounterId === "string" ? source.encounterId : null;
      return next;
    }

    function sanitizeSelection(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : {};
      return {
        avatarId: typeof source.avatarId === "string" ? source.avatarId : null,
        classId: typeof source.classId === "string" ? source.classId : null,
        backgroundId: typeof source.backgroundId === "string" ? source.backgroundId : null,
        locked: source.locked === true,
        autoAssigned: source.autoAssigned === true,
        avatar: source.avatar ? sanitizeCatalogEntry(source.avatar) : null,
        class: source.class ? sanitizeCatalogEntry(source.class) : null,
        background: source.background ? sanitizeCatalogEntry(source.background) : null,
      };
    }

    function sanitizeParticipant(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : {};
      return {
        seatId: typeof source.seatId === "string" ? source.seatId : "user",
        provider: typeof source.provider === "string" ? source.provider : "user",
        type: typeof source.type === "string" ? source.type : "local-user",
        nickname:
          typeof source.nickname === "string" && source.nickname !== "" ? source.nickname : "Seat",
        ready: source.ready === true,
        connected: source.connected !== false,
        active: source.active !== false,
        selection: sanitizeSelection(source.selection),
        decisionChoiceId:
          typeof source.decisionChoiceId === "string" ? source.decisionChoiceId : null,
        combat:
          source.combat &&
          typeof source.combat === "object" &&
          Array.isArray(source.combat) === false
            ? cloneJsonValue(source.combat)
            : null,
      };
    }

    function sanitizeCurrentStep(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : null;
      if (!source) {
        return null;
      }
      return {
        id: typeof source.id === "string" ? source.id : "",
        title: typeof source.title === "string" ? source.title : "",
        body: typeof source.body === "string" ? source.body : "",
        speaker: typeof source.speaker === "string" ? source.speaker : "",
        location:
          source.location &&
          typeof source.location === "object" &&
          Array.isArray(source.location) === false
            ? cloneJsonValue(source.location)
            : null,
        sceneAsset: sanitizeAssetLink(source.sceneAsset),
        npcs: Array.isArray(source.npcs) ? source.npcs.map(sanitizeAssetLink) : [],
        items: Array.isArray(source.items) ? source.items.map(sanitizeAssetLink) : [],
        creatures: Array.isArray(source.creatures) ? source.creatures.map(sanitizeAssetLink) : [],
        choices: Array.isArray(source.choices) ? source.choices.map(sanitizeChoice) : [],
      };
    }

    function sanitizeDecision(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : null;
      if (!source) {
        return null;
      }
      return {
        stepId: typeof source.stepId === "string" ? source.stepId : "",
        choiceIds: Array.isArray(source.choiceIds)
          ? source.choiceIds.filter(function (value) {
              return typeof value === "string" && value.trim() !== "";
            })
          : [],
        votes:
          source.votes && typeof source.votes === "object" && Array.isArray(source.votes) === false
            ? cloneJsonValue(source.votes)
            : {},
        participantIds: Array.isArray(source.participantIds)
          ? source.participantIds.filter(function (value) {
              return typeof value === "string" && value.trim() !== "";
            })
          : [],
        resolvedChoiceId:
          typeof source.resolvedChoiceId === "string" ? source.resolvedChoiceId : null,
        conflict: source.conflict === true,
        pendingSeatIds: Array.isArray(source.pendingSeatIds)
          ? source.pendingSeatIds.filter(function (value) {
              return typeof value === "string" && value.trim() !== "";
            })
          : [],
        deadlineAt:
          typeof source.deadlineAt === "number" && Number.isFinite(source.deadlineAt)
            ? source.deadlineAt
            : null,
      };
    }

    function sanitizeCombat(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : null;
      if (!source) {
        return null;
      }
      return {
        encounterId: typeof source.encounterId === "string" ? source.encounterId : "",
        outcome: typeof source.outcome === "string" ? source.outcome : "pending",
        round:
          typeof source.round === "number" && Number.isFinite(source.round)
            ? Math.max(1, source.round)
            : 1,
        turn:
          source.turn && typeof source.turn === "object" && Array.isArray(source.turn) === false
            ? cloneJsonValue(source.turn)
            : null,
        turnId: typeof source.turnId === "string" ? source.turnId : null,
        party: Array.isArray(source.party)
          ? source.party.map(function (entry) {
              return {
                ...cloneJsonValue(entry),
                selection: entry && entry.selection ? sanitizeSelection(entry.selection) : null,
              };
            })
          : [],
        enemy:
          source.enemy && typeof source.enemy === "object" && Array.isArray(source.enemy) === false
            ? {
                ...cloneJsonValue(source.enemy),
                asset: sanitizeAssetLink(source.enemy.asset),
              }
            : {
                label: "Enemy",
                hp: 0,
                maxHp: 0,
                asset: createDefaultAsset(null),
              },
        recentLog: Array.isArray(source.recentLog)
          ? source.recentLog.filter(function (entry) {
              return typeof entry === "string" && entry.trim() !== "";
            })
          : [],
        availableActions: Array.isArray(source.availableActions)
          ? source.availableActions.map(function (entry) {
              const actionSource =
                entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
              return {
                id: typeof actionSource.id === "string" ? actionSource.id : "",
                label: typeof actionSource.label === "string" ? actionSource.label : "Action",
                type: typeof actionSource.type === "string" ? actionSource.type : "utility",
                cost:
                  typeof actionSource.cost === "number" && Number.isFinite(actionSource.cost)
                    ? actionSource.cost
                    : 0,
                description:
                  typeof actionSource.description === "string" ? actionSource.description : "",
                available: actionSource.available !== false,
              };
            })
          : [],
      };
    }

    function sanitizeAmbientPacket(candidate, kind) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : null;
      if (!source || typeof source.text !== "string" || source.text.trim() === "") {
        return null;
      }
      return {
        kind: kind || "dm",
        seatId: typeof source.seatId === "string" ? source.seatId : null,
        phase: typeof source.phase === "string" ? source.phase : null,
        text: source.text,
        stepId: typeof source.stepId === "string" ? source.stepId : null,
        encounterId: typeof source.encounterId === "string" ? source.encounterId : null,
        turnId: typeof source.turnId === "string" ? source.turnId : null,
        updatedAt:
          typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt)
            ? source.updatedAt
            : null,
      };
    }

    function sanitizeFateKnotsState(candidate) {
      const source =
        candidate && typeof candidate === "object" && Array.isArray(candidate) === false
          ? candidate
          : {};
      const next = createFateKnotsState();
      next.active = source.active === true;
      next.phase = typeof source.phase === "string" ? source.phase : next.phase;
      next.statusKey = typeof source.statusKey === "string" ? source.statusKey : next.statusKey;
      next.status = typeof source.status === "string" ? source.status : next.status;
      next.compatibility =
        source.compatibility &&
        typeof source.compatibility === "object" &&
        Array.isArray(source.compatibility) === false
          ? cloneJsonValue(source.compatibility)
          : next.compatibility;
      next.sessionId = typeof source.sessionId === "string" ? source.sessionId : null;
      next.participantMode =
        typeof source.participantMode === "string" ? source.participantMode : next.participantMode;
      next.rosterLocked = source.rosterLocked === true;
      next.participants = Array.isArray(source.participants)
        ? source.participants.map(sanitizeParticipant)
        : next.participants;
      next.excludedSeats = Array.isArray(source.excludedSeats)
        ? cloneJsonValue(source.excludedSeats)
        : [];
      next.waiting =
        source.waiting &&
        typeof source.waiting === "object" &&
        Array.isArray(source.waiting) === false
          ? cloneJsonValue(source.waiting)
          : next.waiting;
      next.map =
        source.map && typeof source.map === "object" && Array.isArray(source.map) === false
          ? {
              ...cloneJsonValue(source.map),
              mapAsset: sanitizeAssetLink(source.map.mapAsset),
            }
          : next.map;
      next.currentStep = sanitizeCurrentStep(source.currentStep);
      next.decision = sanitizeDecision(source.decision);
      next.combat = sanitizeCombat(source.combat);
      next.result =
        source.result && typeof source.result === "object" && Array.isArray(source.result) === false
          ? cloneJsonValue(source.result)
          : next.result;
      next.dmNarration = sanitizeAmbientPacket(source.dmNarration, "dm");
      next.npcBanter = sanitizeAmbientPacket(source.npcBanter, "npc");
      next.profile =
        source.profile &&
        typeof source.profile === "object" &&
        Array.isArray(source.profile) === false
          ? cloneJsonValue(source.profile)
          : next.profile;
      next.history = Array.isArray(source.history)
        ? source.history.filter(function (entry) {
            return entry && typeof entry === "object" && Array.isArray(entry) === false;
          })
        : [];
      next.saveSlot =
        source.saveSlot &&
        typeof source.saveSlot === "object" &&
        Array.isArray(source.saveSlot) === false
          ? cloneJsonValue(source.saveSlot)
          : next.saveSlot;
      next.scenarioLog = Array.isArray(source.scenarioLog)
        ? source.scenarioLog.filter(function (entry) {
            return typeof entry === "string" && entry.trim() !== "";
          })
        : [];
      next.catalogs = {
        avatars: Array.isArray(source.catalogs && source.catalogs.avatars)
          ? source.catalogs.avatars.map(sanitizeCatalogEntry)
          : [],
        classes: Array.isArray(source.catalogs && source.catalogs.classes)
          ? source.catalogs.classes.map(sanitizeCatalogEntry)
          : [],
        backgrounds: Array.isArray(source.catalogs && source.catalogs.backgrounds)
          ? source.catalogs.backgrounds.map(sanitizeCatalogEntry)
          : [],
      };
      next.assetCoverage =
        source.assetCoverage &&
        typeof source.assetCoverage === "object" &&
        Array.isArray(source.assetCoverage) === false
          ? cloneJsonValue(source.assetCoverage)
          : {};
      next.contentErrors = Array.isArray(source.contentErrors) ? source.contentErrors.slice() : [];
      next.contentSummary =
        source.contentSummary &&
        typeof source.contentSummary === "object" &&
        Array.isArray(source.contentSummary) === false
          ? cloneJsonValue(source.contentSummary)
          : next.contentSummary;
      next.user =
        source.user && typeof source.user === "object" && Array.isArray(source.user) === false
          ? cloneJsonValue(source.user)
          : next.user;
      next.transport =
        source.transport &&
        typeof source.transport === "object" &&
        Array.isArray(source.transport) === false
          ? cloneJsonValue(source.transport)
          : next.transport;
      next.uiAssets =
        source.uiAssets &&
        typeof source.uiAssets === "object" &&
        Array.isArray(source.uiAssets) === false
          ? {
              ...cloneJsonValue(source.uiAssets),
              featureView: sanitizeAssetLink(source.uiAssets.featureView),
            }
          : next.uiAssets;
      return next;
    }

    function getCurrentState() {
      return sanitizeFateKnotsState(getState().fateKnots);
    }

    function getLocale() {
      const state = getState();
      return typeof state.locale === "string" && state.locale.trim() !== ""
        ? state.locale
        : undefined;
    }

    function getCurrentStatus(state) {
      const rootState = getState();
      if (rootState.lastCommandMessage && rootState.lastCommandMessage.trim() !== "") {
        return rootState.lastCommandMessage.trim();
      }
      if (state.status && state.status.trim() !== "") {
        return state.status.trim();
      }
      return t(["fateKnots", "status", "idle"], "Prepare a run.");
    }

    function findParticipant(state, seatId) {
      return (
        state.participants.find(function (participant) {
          return participant.seatId === seatId;
        }) || null
      );
    }

    function getUserParticipant(state) {
      return findParticipant(state, "user") || createDefaultParticipant("user");
    }

    function isSelectionComplete(selection) {
      return !!(selection && selection.avatarId && selection.classId && selection.backgroundId);
    }

    function resolveCatalogEntry(list, id, fallback) {
      if (fallback && fallback.id) {
        return fallback;
      }
      return (
        list.find(function (entry) {
          return entry.id === id;
        }) || null
      );
    }

    function getSelectionBundle(state, participant) {
      const selection = participant.selection || createDefaultSelection();
      return {
        avatar: resolveCatalogEntry(state.catalogs.avatars, selection.avatarId, selection.avatar),
        classDef: resolveCatalogEntry(state.catalogs.classes, selection.classId, selection.class),
        background: resolveCatalogEntry(
          state.catalogs.backgrounds,
          selection.backgroundId,
          selection.background
        ),
      };
    }

    function sendSelection(fieldName, value) {
      const payload = {};
      payload[fieldName] = value;
      sendRoomCommand("GameRoomFateKnotsCharacterSelect", payload);
    }

    function sendReady(state) {
      const payload = {};
      if (state.sessionId) {
        payload.sessionId = state.sessionId;
      }
      sendRoomCommand("GameRoomFateKnotsReady", payload);
    }

    function sendChoice(state, choiceId) {
      const payload = {
        choiceId: choiceId,
      };
      if (state.sessionId) {
        payload.sessionId = state.sessionId;
      }
      if (state.currentStep && state.currentStep.id) {
        payload.stepId = state.currentStep.id;
      }
      sendRoomCommand("GameRoomFateKnotsChoice", payload);
    }

    function sendCombatAction(state, actionId) {
      const combat = state.combat || {};
      const payload = {
        actionId: actionId,
      };
      if (state.sessionId) {
        payload.sessionId = state.sessionId;
      }
      if (combat.encounterId) {
        payload.encounterId = combat.encounterId;
      }
      if (combat.turnId) {
        payload.turnId = combat.turnId;
      }
      sendRoomCommand("GameRoomFateKnotsCombatAction", payload);
    }

    function sendSync(state) {
      const payload = {};
      if (state.sessionId) {
        payload.sessionId = state.sessionId;
      }
      sendRoomCommand("GameRoomFateKnotsSync", payload);
    }

    function formatMetricValue(value) {
      return value === null || value === undefined || value === "" ? "-" : String(value);
    }

    function formatStats(entry) {
      if (!entry || !entry.stats) {
        return "";
      }
      const stats = entry.stats;
      return [
        "HP " + formatMetricValue(stats.maxHp),
        "ATK " + formatMetricValue(stats.attack),
        "DEF " + formatMetricValue(stats.defense),
        "SPD " + formatMetricValue(stats.speed),
        "EN " + formatMetricValue(stats.energy),
      ].join(" • ");
    }

    function formatDeck(entry) {
      if (!entry || !Array.isArray(entry.startingDeck) || entry.startingDeck.length === 0) {
        return "";
      }
      return entry.startingDeck.join(", ");
    }

    function formatDeadline(deadlineAt) {
      if (typeof deadlineAt !== "number" || Number.isFinite(deadlineAt) !== true) {
        return "";
      }
      return new Date(deadlineAt).toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function formatHistoryTimestamp(timestamp) {
      if (typeof timestamp !== "number" || Number.isFinite(timestamp) !== true) {
        return "";
      }
      return new Date(timestamp).toLocaleString(getLocale(), {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const KNOWN_SEAT_IDS = ["user", "ai1", "ai2", "us1"];
    const UI_ASSET_ROOT = "../main-functions/fate-knots/assets/ui/";

    function createStaticUiAsset(assetId, relativeUiPath) {
      return sanitizeAssetLink({
        assetId: assetId,
        uiSrc: relativeUiPath,
        src: relativeUiPath.replace(/^\.\.\//, ""),
      });
    }

    const UI_ASSETS = Object.freeze({
      activeGlowPanel: createStaticUiAsset(
        "active_glow_panel",
        UI_ASSET_ROOT + "buttons/active_glow_panel.webp"
      ),
      choiceButton: createStaticUiAsset(
        "choice_button",
        UI_ASSET_ROOT + "buttons/choice_button.webp"
      ),
      darkPanel: createStaticUiAsset("dark_panel", UI_ASSET_ROOT + "buttons/dark_panel.webp"),
      defaultPanel: createStaticUiAsset(
        "default_panel",
        UI_ASSET_ROOT + "buttons/default_panel.webp"
      ),
      disabledPanel: createStaticUiAsset(
        "disabled_panel",
        UI_ASSET_ROOT + "buttons/disabled_panel.webp"
      ),
      primaryButton: createStaticUiAsset(
        "primary_button",
        UI_ASSET_ROOT + "buttons/primary_button.webp"
      ),
      secondaryButton: createStaticUiAsset(
        "secondary_button",
        UI_ASSET_ROOT + "buttons/secondary_button.webp"
      ),
      buttonPlate: createStaticUiAsset("button_plate", UI_ASSET_ROOT + "frames/button_plate.webp"),
      cardSlotFrame: createStaticUiAsset(
        "card_slot_frame",
        UI_ASSET_ROOT + "frames/card_slot_frame.webp"
      ),
      logPanelFrame: createStaticUiAsset(
        "log_panel_frame",
        UI_ASSET_ROOT + "frames/log_panel_frame.webp"
      ),
      mainSceneFrame: createStaticUiAsset(
        "main_scene_frame",
        UI_ASSET_ROOT + "frames/main_scene_frame.webp"
      ),
      sidePanelFrame: createStaticUiAsset(
        "side_panel_frame",
        UI_ASSET_ROOT + "frames/side_panel_frame.webp"
      ),
      topStatusBar: createStaticUiAsset(
        "top_status_bar",
        UI_ASSET_ROOT + "frames/top_status_bar.webp"
      ),
      avatarCardTemplate: createStaticUiAsset(
        "avatar_card_template",
        UI_ASSET_ROOT + "cards/avatar_card_template.webp"
      ),
      classCardTemplate: createStaticUiAsset(
        "class_card_template",
        UI_ASSET_ROOT + "cards/class_card_template.webp"
      ),
      creatureCardTemplate: createStaticUiAsset(
        "creature_card_template",
        UI_ASSET_ROOT + "cards/creature_card_template.webp"
      ),
      itemCardTemplate: createStaticUiAsset(
        "item_card_template",
        UI_ASSET_ROOT + "cards/item_card_template.webp"
      ),
      locationCardTemplate: createStaticUiAsset(
        "location_card_template",
        UI_ASSET_ROOT + "cards/location_card_template.webp"
      ),
      cardDisabled: createStaticUiAsset(
        "card_disabled",
        UI_ASSET_ROOT + "card-effects/card_disabled.webp"
      ),
      cardFocusBorder: createStaticUiAsset(
        "card_focus_border",
        UI_ASSET_ROOT + "card-effects/card_focus_border.webp"
      ),
      cardHoverGlow: createStaticUiAsset(
        "card_hover_glow",
        UI_ASSET_ROOT + "card-effects/card_hover_glow.webp"
      ),
      cardSelected: createStaticUiAsset(
        "card_selected",
        UI_ASSET_ROOT + "card-effects/card_selected.webp"
      ),
      logPanel: createStaticUiAsset("log_panel", UI_ASSET_ROOT + "dialogue/log_panel.webp"),
      notificationBanner: createStaticUiAsset(
        "notification_banner",
        UI_ASSET_ROOT + "dialogue/notification_banner.webp"
      ),
      systemMessageBox: createStaticUiAsset(
        "system_message_box",
        UI_ASSET_ROOT + "dialogue/system_message_box.webp"
      ),
      targetRing: createStaticUiAsset("target_ring", UI_ASSET_ROOT + "combat-fx/target_ring.webp"),
      turnIndicator: createStaticUiAsset(
        "turn_indicator",
        UI_ASSET_ROOT + "combat-fx/turn_indicator.webp"
      ),
      turnOrderMarker: createStaticUiAsset(
        "turn_order_marker",
        UI_ASSET_ROOT + "combat-fx/turn_order_marker.webp"
      ),
      diceBadge: createStaticUiAsset("dice_badge", UI_ASSET_ROOT + "combat-icons/dice_badge.webp"),
      shield: createStaticUiAsset("shield", UI_ASSET_ROOT + "combat-icons/shield.webp"),
      targetMarker: createStaticUiAsset(
        "target_marker",
        UI_ASSET_ROOT + "combat-icons/target_marker.webp"
      ),
      activeMarker: createStaticUiAsset("active_marker", UI_ASSET_ROOT + "map/active_marker.webp"),
      hoverRing: createStaticUiAsset("hover_ring", UI_ASSET_ROOT + "map/hover_ring.webp"),
      lockedMarker: createStaticUiAsset("locked_marker", UI_ASSET_ROOT + "map/locked_marker.webp"),
      mapMarker: createStaticUiAsset("map_marker", UI_ASSET_ROOT + "map/map_marker.webp"),
      mapCrest: createStaticUiAsset("map_ui_crest", UI_ASSET_ROOT + "map/map_ui_crest.webp"),
      selectionGlow: createStaticUiAsset(
        "selection_glow",
        UI_ASSET_ROOT + "map/selection_glow.webp"
      ),
      cornerOrnament: createStaticUiAsset(
        "corner_ornament",
        UI_ASSET_ROOT + "overlays/corner_ornament.webp"
      ),
      fogPatch: createStaticUiAsset("fog_patch", UI_ASSET_ROOT + "overlays/fog_patch.webp"),
      lightGlowPatch: createStaticUiAsset(
        "light_glow_patch",
        UI_ASSET_ROOT + "overlays/light_glow_patch.webp"
      ),
      parchmentStain: createStaticUiAsset(
        "parchment_stain",
        UI_ASSET_ROOT + "overlays/parchment_stain.webp"
      ),
      subtleRuneOverlay: createStaticUiAsset(
        "subtle_rune_overlay",
        UI_ASSET_ROOT + "overlays/subtle_rune_overlay.webp"
      ),
      vignettePatch: createStaticUiAsset(
        "vignette_patch",
        UI_ASSET_ROOT + "overlays/vignette_patch.webp"
      ),
      buffIndicator: createStaticUiAsset(
        "buff_indicator",
        UI_ASSET_ROOT + "status/buff_indicator.webp"
      ),
      debuffIndicator: createStaticUiAsset(
        "debuff_indicator",
        UI_ASSET_ROOT + "status/debuff_indicator.webp"
      ),
      healthBar: createStaticUiAsset("health_bar", UI_ASSET_ROOT + "status/health_bar.webp"),
      manaBar: createStaticUiAsset("mana_bar", UI_ASSET_ROOT + "status/mana_bar.webp"),
      statusSlot: createStaticUiAsset("status_slot", UI_ASSET_ROOT + "status/status_slot.webp"),
      turnBadge: createStaticUiAsset("turn_badge", UI_ASSET_ROOT + "status/turn_badge.webp"),
    });

    let hasPreloadedUiAssets = false;

    function getUiAsset(key) {
      return UI_ASSETS[key] || createDefaultAsset(null);
    }

    function ensureUiAssetsPreloaded() {
      if (hasPreloadedUiAssets) {
        return;
      }
      hasPreloadedUiAssets = true;
      if (typeof global.Image !== "function") {
        return;
      }
      Object.keys(UI_ASSETS).forEach(function (key) {
        const asset = getUiAsset(key);
        const source = assetUrl(asset);
        if (!source) {
          return;
        }
        const image = new global.Image();
        image.src = source;
      });
    }

    function createRegion(tagName, className, role) {
      const element = createElement(tagName, className || "");
      if (role) {
        element.dataset.fkRole = role;
      }
      return element;
    }

    function setSeatId(element, seatId) {
      if (element && seatId) {
        element.dataset.seatId = seatId;
      }
      return element;
    }

    function assetUrl(assetLink) {
      const normalized = sanitizeAssetLink(assetLink);
      return normalized.uiSrc || normalized.src || "";
    }

    function applyAssetLayers(element, layers) {
      const normalizedLayers = (Array.isArray(layers) ? layers : [])
        .map(function (layer) {
          if (!layer) {
            return null;
          }
          const source = assetUrl(layer.asset || layer);
          if (!source) {
            return null;
          }
          return {
            url: source,
            size: layer.size || "cover",
            position: layer.position || "center",
            repeat: layer.repeat || "no-repeat",
            blend: layer.blend || "normal",
          };
        })
        .filter(Boolean);

      if (normalizedLayers.length === 0) {
        return;
      }

      element.style.backgroundImage = normalizedLayers
        .map(function (layer) {
          return 'url("' + layer.url + '")';
        })
        .join(", ");
      element.style.backgroundSize = normalizedLayers
        .map(function (layer) {
          return layer.size;
        })
        .join(", ");
      element.style.backgroundPosition = normalizedLayers
        .map(function (layer) {
          return layer.position;
        })
        .join(", ");
      element.style.backgroundRepeat = normalizedLayers
        .map(function (layer) {
          return layer.repeat;
        })
        .join(", ");
      element.style.backgroundBlendMode = normalizedLayers
        .map(function (layer) {
          return layer.blend;
        })
        .join(", ");
    }

    function applyFrameArtwork(element, options) {
      const config = options || {};
      applyAssetLayers(element, [
        config.overlay
          ? {
              asset: config.overlay,
              size: config.overlaySize || "cover",
              position: config.overlayPosition || "center",
              blend: config.overlayBlend || "screen",
            }
          : null,
        config.frame
          ? {
              asset: config.frame,
              size: config.frameSize || "100% 100%",
              position: config.framePosition || "center",
            }
          : null,
        config.texture
          ? {
              asset: config.texture,
              size: config.textureSize || "100% 100%",
              position: config.texturePosition || "center",
            }
          : null,
      ]);
    }

    function createFrame(tagName, className, role, options) {
      const frame = createRegion(tagName, className, role);
      applyFrameArtwork(frame, options);
      return frame;
    }

    function appendImage(parent, className, assetLink, altText) {
      const normalized = sanitizeAssetLink(assetLink);
      if (!normalized.uiSrc) {
        return null;
      }
      const image = createElement("img", className || "");
      image.src = normalized.uiSrc;
      image.alt = altText || "";
      parent.append(image);
      return image;
    }

    function createTextChip(label, tone) {
      const chip = createElement("span", "fk-chip" + (tone ? " fk-chip--" + tone : ""), label);
      return chip;
    }

    function createStatBadge(label, value, tone) {
      const item = createRegion(
        "div",
        "fk-stat-badge" + (tone ? " fk-stat-badge--" + tone : ""),
        null
      );
      item.append(createElement("span", "fk-stat-badge__label", label));
      item.append(createElement("strong", "fk-stat-badge__value", value));
      return item;
    }

    function createActionButton(label, variant, disabled, onClick) {
      const button = createRegion(
        "button",
        "fk-button fk-button--" + (variant || "secondary"),
        variant === "primary" ? "primary-action" : "secondary-action"
      );
      button.type = "button";
      button.disabled = disabled === true;
      button.append(createElement("span", "fk-button__label", label));
      applyFrameArtwork(button, {
        overlay:
          disabled === true
            ? getUiAsset("disabledPanel")
            : variant === "primary"
              ? getUiAsset("activeGlowPanel")
              : null,
        frame: getUiAsset("buttonPlate"),
        texture:
          variant === "primary" ? getUiAsset("primaryButton") : getUiAsset("secondaryButton"),
      });
      button.addEventListener("click", function (event) {
        if (button.disabled !== true && typeof onClick === "function") {
          onClick(event);
        }
      });
      return button;
    }

    function createCatalogCard(entry, options) {
      const config = options || {};
      const button = createRegion(
        "button",
        "fk-card-choice fk-card-choice--" + (config.family || "generic"),
        config.role || null
      );
      button.type = "button";
      button.disabled = config.disabled === true;
      button.dataset.selected = config.selected === true ? "true" : "false";
      if (config.seatId) {
        button.dataset.seatId = config.seatId;
      }
      applyFrameArtwork(button, {
        overlay: button.disabled
          ? getUiAsset("cardDisabled")
          : config.selected
            ? getUiAsset("cardSelected")
            : getUiAsset("cardHoverGlow"),
        frame: getUiAsset("cardSlotFrame"),
        texture: config.template || getUiAsset("itemCardTemplate"),
      });
      const art = createRegion("div", "fk-card-choice__art", null);
      appendImage(
        art,
        "fk-card-choice__image",
        entry.asset || entry,
        entry.label || entry.id || ""
      );
      button.append(art);
      const body = createRegion("div", "fk-card-choice__body", null);
      body.append(createElement("strong", "fk-card-choice__title", entry.label || entry.id || ""));
      (config.metaLines || []).forEach(function (line) {
        if (line && line.trim() !== "") {
          body.append(createElement("span", "fk-card-choice__meta", line));
        }
      });
      button.append(body);
      if (typeof config.onClick === "function") {
        button.addEventListener("click", function () {
          if (button.disabled !== true) {
            config.onClick(entry.id);
          }
        });
      }
      return button;
    }

    function createSeatStateText(state, seatDisplay) {
      if (seatDisplay.liveParticipant) {
        if (seatDisplay.liveParticipant.selection && seatDisplay.liveParticipant.selection.locked) {
          return t(["fateKnots", "seatState", "locked"], "Locked");
        }
        if (seatDisplay.liveParticipant.ready) {
          return t(["fateKnots", "seatState", "ready"], "Ready");
        }
        return t(["fateKnots", "seatState", "selecting"], "Selecting");
      }
      if (seatDisplay.excludedReason) {
        return t(["fateKnots", "seatState", "deferred"], "Deferred");
      }
      if (seatDisplay.slotRecord && seatDisplay.slotRecord.connected === false) {
        return t(["fateKnots", "seatState", "reserved"], "Reserved");
      }
      return t(["fateKnots", "seatState", "standby"], "Standby");
    }

    function createSeatLabel(state, seatId) {
      const labelMap = {
        user: t(["fateKnots", "seats", "user"], "You"),
        ai1: t(["fateKnots", "seats", "ai1"], "AI1"),
        ai2: t(["fateKnots", "seats", "ai2"], "AI2"),
        us1: t(["fateKnots", "seats", "us1"], "US1"),
      };
      return labelMap[seatId] || seatId.toUpperCase();
    }

    function getContextSlotRecord(state, seatId) {
      return state && state.context && state.context.slots && state.context.slots[seatId]
        ? state.context.slots[seatId]
        : null;
    }

    function getExcludedSeatReason(state, seatId) {
      if (!Array.isArray(state.excludedSeats)) {
        return null;
      }
      const match = state.excludedSeats.find(function (entry) {
        return entry && typeof entry === "object" && entry.seatId === seatId;
      });
      return match && typeof match.reason === "string" ? match.reason : null;
    }

    function buildSeatDisplay(state, seatId) {
      const liveParticipant = findParticipant(state, seatId);
      const slotRecord = getContextSlotRecord(state, seatId);
      const excludedReason = getExcludedSeatReason(state, seatId);
      const bundle = liveParticipant ? getSelectionBundle(state, liveParticipant) : null;
      const title = liveParticipant
        ? liveParticipant.nickname
        : slotRecord && slotRecord.nickname
          ? slotRecord.nickname
          : createSeatLabel(state, seatId);
      const portraitAsset = bundle && bundle.avatar ? bundle.avatar : null;
      const summaryLines = [];
      if (bundle && (bundle.avatar || bundle.classDef || bundle.background)) {
        summaryLines.push(
          [
            bundle.avatar ? bundle.avatar.label : "-",
            bundle.classDef ? bundle.classDef.label : "-",
            bundle.background ? bundle.background.label : "-",
          ].join(" / ")
        );
      }
      if (!liveParticipant && excludedReason) {
        summaryLines.push(
          t(
            ["fateKnots", "roster", "excluded"],
            "US1 stays outside the V1 playable roster and is tracked for later iterations."
          )
        );
      } else if (!liveParticipant && slotRecord && slotRecord.remoteUserId) {
        summaryLines.push(slotRecord.remoteUserId);
      }
      return {
        seatId: seatId,
        liveParticipant: liveParticipant,
        slotRecord: slotRecord,
        excludedReason: excludedReason,
        bundle: bundle,
        title: title,
        stateText: createSeatStateText(state, {
          liveParticipant: liveParticipant,
          slotRecord: slotRecord,
          excludedReason: excludedReason,
        }),
        eyebrow: createSeatLabel(state, seatId),
        portraitAsset: portraitAsset,
        summaryLines: summaryLines,
        isDummy: !liveParticipant,
        isLocal: seatId === "user",
      };
    }

    function appendNpcBanter(parent, state, seatId) {
      if (!state.npcBanter || state.npcBanter.seatId !== seatId || !state.npcBanter.text) {
        return;
      }
      const bubble = createRegion("div", "fk-seat-banter", null);
      bubble.append(createElement("span", "fk-seat-banter__label", seatId.toUpperCase()));
      bubble.append(createElement("p", "fk-seat-banter__text", state.npcBanter.text));
      parent.append(bubble);
    }

    function createSeatPlaque(state, seatId, role) {
      const seat = buildSeatDisplay(state, seatId);
      const plaque = createFrame(
        "article",
        "fk-seat-plaque" +
          (seat.isDummy ? " fk-seat-plaque--dummy" : "") +
          (seat.isLocal ? " fk-seat-plaque--local" : ""),
        role || "seat-plaque",
        {
          overlay: seat.isDummy ? getUiAsset("fogPatch") : getUiAsset("parchmentStain"),
          frame: getUiAsset("sidePanelFrame"),
          texture: seat.isDummy ? getUiAsset("darkPanel") : getUiAsset("defaultPanel"),
        }
      );
      setSeatId(plaque, seatId);
      const header = createRegion("div", "fk-seat-plaque__header", null);
      header.append(createElement("span", "fk-seat-plaque__eyebrow", seat.eyebrow));
      header.append(
        createTextChip(seat.stateText, seat.isDummy ? "soft" : seat.isLocal ? "accent" : "warm")
      );
      plaque.append(header);
      plaque.append(createElement("strong", "fk-seat-plaque__title", seat.title));
      if (seat.portraitAsset) {
        appendImage(plaque, "fk-seat-plaque__portrait", seat.portraitAsset, seat.title);
      }
      seat.summaryLines.forEach(function (line) {
        plaque.append(createElement("p", "fk-seat-plaque__summary", line));
      });
      appendNpcBanter(plaque, state, seatId);
      return plaque;
    }

    function createSeatRibbon(state, role, activeSeatId) {
      const ribbon = createRegion("div", "fk-seat-ribbon", role || "seat-ribbon");
      KNOWN_SEAT_IDS.forEach(function (seatId) {
        const seat = buildSeatDisplay(state, seatId);
        const chip = createRegion(
          "div",
          "fk-seat-ribbon__chip" +
            (seat.isDummy ? " fk-seat-ribbon__chip--dummy" : "") +
            (activeSeatId === seatId ? " fk-seat-ribbon__chip--active" : ""),
          null
        );
        setSeatId(chip, seatId);
        chip.append(createElement("span", "fk-seat-ribbon__name", seat.eyebrow));
        chip.append(createElement("span", "fk-seat-ribbon__state", seat.stateText));
        if (state.npcBanter && state.npcBanter.seatId === seatId && state.npcBanter.text) {
          chip.append(createElement("span", "fk-seat-ribbon__state", state.npcBanter.text));
        }
        ribbon.append(chip);
      });
      return ribbon;
    }

    function createTopbar(state, phaseId) {
      const topbar = createFrame("header", "fk-topbar", "topbar");
      const titleCluster = createRegion("div", "fk-topbar__cluster", null);
      titleCluster.append(
        createElement("p", "fk-topbar__eyebrow", t(["fateKnots", "heroBadge"], "Game Room"))
      );
      titleCluster.append(
        createElement("h1", "fk-topbar__title", t(["fateKnots", "heroTitle"], "Fate Knots Table"))
      );
      titleCluster.append(createElement("p", "fk-topbar__subtitle", getCurrentStatus(state)));
      topbar.append(titleCluster);

      const statusCluster = createRegion("div", "fk-topbar__meta", null);
      statusCluster.append(createTextChip(phaseId.replace(/-/g, " "), "soft"));
      if (
        state.waiting &&
        Array.isArray(state.waiting.pendingSeatIds) &&
        state.waiting.pendingSeatIds.length > 0
      ) {
        statusCluster.append(
          createTextChip(
            t(["fateKnots", "status", "pendingSeats"], "Pending") +
              ": " +
              state.waiting.pendingSeatIds.join(", "),
            "alert"
          )
        );
      }
      if (state.compatibility && state.compatibility.mode !== "fresh") {
        statusCluster.append(createTextChip(state.compatibility.mode, "alert"));
      }
      if (state.waiting && state.waiting.deadlineAt) {
        statusCluster.append(
          createTextChip(
            t(["fateKnots", "status", "deadline"], "Deadline") +
              ": " +
              formatDeadline(state.waiting.deadlineAt),
            "warm"
          )
        );
      }
      topbar.append(statusCluster);
      return topbar;
    }

    function createCoverageLedger(state) {
      const ledger = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--ledger fk-coverage-ledger",
        "coverage-ledger"
      );
      ledger.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "coverage", "title"], "Visible Asset Coverage")
        )
      );
      const grid = createRegion("div", "fk-ledger__grid", null);
      Object.keys(state.assetCoverage || {}).forEach(function (key) {
        const item = createRegion("div", "fk-ledger__item", null);
        item.append(createElement("span", "fk-ledger__label", key));
        item.append(createElement("strong", "fk-ledger__value", String(state.assetCoverage[key])));
        grid.append(item);
      });
      const assetErrors = createRegion("div", "fk-ledger__item", null);
      assetErrors.append(createElement("span", "fk-ledger__label", "assetErrors"));
      assetErrors.append(
        createElement("strong", "fk-ledger__value", String(state.contentSummary.assetErrors || 0))
      );
      grid.append(assetErrors);
      const sourceErrors = createRegion("div", "fk-ledger__item", null);
      sourceErrors.append(createElement("span", "fk-ledger__label", "sourceErrors"));
      sourceErrors.append(
        createElement("strong", "fk-ledger__value", String(state.contentSummary.sourceErrors || 0))
      );
      grid.append(sourceErrors);
      ledger.append(grid);
      if (state.contentErrors.length > 0) {
        ledger.append(createElement("p", "fk-frame__hint", state.contentErrors.join(" | ")));
      }
      return ledger;
    }

    function createNarrationPanel(state, role) {
      const panel = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--log fk-narration-panel",
        role || "narration-panel",
        {
          overlay: getUiAsset("notificationBanner"),
          frame: getUiAsset("logPanelFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      panel.append(
        createElement("p", "fk-frame__eyebrow", t(["fateKnots", "narration", "title"], "DM Thread"))
      );
      if (state.dmNarration && state.dmNarration.text) {
        panel.append(createElement("p", "fk-narration-panel__text", state.dmNarration.text));
      } else {
        panel.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(
              ["fateKnots", "narration", "empty"],
              "Ambient narration will appear here when a packet arrives."
            )
          )
        );
      }
      return panel;
    }

    function createMemoryRail(state) {
      const panel = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--rail fk-memory-rail",
        "history-rail"
      );
      panel.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "memory", "profileTitle"], "Remembered Build")
        )
      );
      const profileBlock = createRegion("div", "fk-memory-rail__block", null);
      const profileValues = [
        state.profile?.avatarId || "-",
        state.profile?.classId || "-",
        state.profile?.backgroundId || "-",
      ];
      profileBlock.append(
        createElement("strong", "fk-memory-rail__title", profileValues.join(" / "))
      );
      profileBlock.append(
        createElement(
          "p",
          "fk-frame__hint",
          t(["fateKnots", "memory", "saveSlotIdle"], "Full resume stays deferred for now.")
        )
      );
      panel.append(profileBlock);

      const historyBlock = createRegion("div", "fk-memory-rail__block", null);
      historyBlock.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "memory", "historyTitle"], "Recent Knots")
        )
      );
      const historyList = createRegion("div", "fk-history-list", null);
      if (Array.isArray(state.history) && state.history.length > 0) {
        state.history.slice(0, 3).forEach(function (entry) {
          const item = createRegion("div", "fk-history-list__item", null);
          const title =
            entry && entry.title
              ? entry.title
              : t(["fateKnots", "result", "titleFallback"], "Run Complete");
          item.append(createElement("strong", "fk-history-list__title", title));
          item.append(
            createElement("span", "fk-history-list__meta", formatHistoryTimestamp(entry.timestamp))
          );
          item.append(createElement("p", "fk-frame__hint", entry.summary || ""));
          historyList.append(item);
        });
      } else {
        historyList.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(["fateKnots", "memory", "emptyHistory"], "No completed runs yet.")
          )
        );
      }
      historyBlock.append(historyList);
      panel.append(historyBlock);
      return panel;
    }

    function createMapShell(state) {
      const shell = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-map-shell",
        "map-shell",
        {
          overlay: getUiAsset("subtleRuneOverlay"),
          frame: getUiAsset("mainSceneFrame"),
          texture: getUiAsset("defaultPanel"),
        }
      );
      const header = createRegion("div", "fk-frame__header", null);
      header.append(
        createElement("p", "fk-frame__eyebrow", t(["fateKnots", "map", "title"], "Route Map"))
      );
      header.append(
        createElement("h2", "fk-frame__title", t(["fateKnots", "heroTitle"], "Fate Knots Table"))
      );
      header.append(
        createElement(
          "p",
          "fk-frame__hint",
          t(
            ["fateKnots", "heroSubtitle"],
            "A co-op story-combat slice with deterministic AI companions, unanimous votes, and one opening encounter."
          )
        )
      );
      shell.append(header);

      const figure = createRegion("div", "fk-map-shell__figure", null);
      const mapAsset =
        state.map && state.map.mapAsset ? state.map.mapAsset : createDefaultAsset(null);
      appendImage(
        figure,
        "fk-map-shell__image",
        mapAsset,
        t(["fateKnots", "map", "title"], "Route Map")
      );
      const crest = createRegion("div", "fk-map-shell__crest", null);
      applyFrameArtwork(crest, { texture: getUiAsset("mapCrest") });
      figure.append(crest);
      if (state.map && Array.isArray(state.map.nodes)) {
        state.map.nodes.forEach(function (node) {
          if (!node || !node.marker) {
            return;
          }
          const marker = createRegion(
            "div",
            "fk-map-shell__marker" +
              (state.map.currentLocationId === node.id ? " fk-map-shell__marker--active" : ""),
            null
          );
          marker.style.left = String(node.marker.xPct || 0) + "%";
          marker.style.top = String(node.marker.yPct || 0) + "%";
          applyFrameArtwork(marker, {
            texture:
              state.map.currentLocationId === node.id
                ? getUiAsset("activeMarker")
                : getUiAsset("mapMarker"),
            overlay: state.map.currentLocationId === node.id ? getUiAsset("selectionGlow") : null,
          });
          marker.append(
            createElement("span", "fk-map-shell__marker-label", node.label || node.id || "Node")
          );
          figure.append(marker);
        });
      }
      shell.append(figure);
      return shell;
    }

    function renderOverviewStage(parent, state) {
      const layout = createRegion("section", "fk-overview", "overview-layout");
      const main = createRegion("div", "fk-overview__main", null);
      const mapShell = createMapShell(state);
      if (mapShell.classList && typeof mapShell.classList.add === "function") {
        mapShell.classList.add("fk-overview__map");
      } else {
        mapShell.className =
          (mapShell.className ? mapShell.className + " " : "") + "fk-overview__map";
      }
      main.append(mapShell);
      main.append(createMemoryRail(state));
      layout.append(main);

      const rail = createFrame(
        "aside",
        "fk-stage-frame fk-stage-frame--rail fk-overview__rail",
        "right-rail",
        {
          frame: getUiAsset("sidePanelFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      rail.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "overview", "partyTitle"], "Gathered Seats")
        )
      );
      const seatGrid = createRegion("div", "fk-seat-grid", null);
      KNOWN_SEAT_IDS.forEach(function (seatId) {
        seatGrid.append(createSeatPlaque(state, seatId, "roster-seat"));
      });
      rail.append(seatGrid);
      const actionZone = createRegion("div", "fk-action-cluster", "start-zone");
      actionZone.append(
        createActionButton(
          t(["fateKnots", "controls", "start"], "Start Run"),
          "primary",
          state.phase !== "idle" && state.phase !== "result",
          function () {
            sendRoomCommand("GameRoomFateKnotsStart", {});
          }
        )
      );
      actionZone.append(
        createActionButton(
          t(["fateKnots", "controls", "reset"], "Reset Run"),
          "secondary",
          false,
          function () {
            sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      rail.append(actionZone);
      if (state.excludedSeats && state.excludedSeats.length > 0) {
        rail.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(
              ["fateKnots", "roster", "excluded"],
              "US1 stays outside the V1 playable roster and is tracked for later iterations."
            )
          )
        );
      }
      if (state.transport && state.transport.remoteUserId) {
        rail.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(["fateKnots", "roster", "remoteUserLabel"], "US1: {id}").replace(
              "{id}",
              state.transport.remoteUserId
            )
          )
        );
      }
      layout.append(rail);
      parent.append(layout);
    }

    function renderSelectionFamily(
      parent,
      state,
      title,
      entries,
      selectedId,
      disabled,
      onSelect,
      metaResolver,
      family
    ) {
      const familySection = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--selection fk-selection-family",
        family + "-family",
        {
          overlay: getUiAsset("parchmentStain"),
          frame: getUiAsset("sidePanelFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      familySection.append(createElement("p", "fk-frame__eyebrow", title));
      const grid = createRegion("div", "fk-selection-family__grid", null);
      entries.forEach(function (entry) {
        const template =
          family === "avatar"
            ? getUiAsset("avatarCardTemplate")
            : family === "class"
              ? getUiAsset("classCardTemplate")
              : getUiAsset("itemCardTemplate");
        const card = createCatalogCard(entry, {
          family: family,
          template: template,
          selected: entry.id === selectedId,
          disabled: disabled,
          onClick: onSelect,
          metaLines: metaResolver(entry),
        });
        grid.append(card);
      });
      familySection.append(grid);
      parent.append(familySection);
    }

    function createSelectionSummary(state, selection) {
      const user = getUserParticipant(state);
      const bundle = getSelectionBundle(state, user);
      const summary = createFrame(
        "aside",
        "fk-stage-frame fk-stage-frame--rail fk-summary-rail",
        "summary-rail",
        {
          overlay: getUiAsset("notificationBanner"),
          frame: getUiAsset("sidePanelFrame"),
          texture: getUiAsset("defaultPanel"),
        }
      );
      summary.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "creation", "summaryTitle"], "Build Summary")
        )
      );
      const seatTabs = createRegion("div", "fk-seat-tabs", null);
      summary.append(seatTabs);
      KNOWN_SEAT_IDS.forEach(function (seatId) {
        const seat = buildSeatDisplay(state, seatId);
        const tab = createRegion(
          "div",
          "fk-seat-tabs__item" +
            (seatId === "user" ? " fk-seat-tabs__item--active" : " fk-seat-tabs__item--dummy"),
          null
        );
        setSeatId(tab, seatId);
        tab.append(createElement("span", "fk-seat-tabs__label", seat.eyebrow));
        tab.append(
          createElement(
            "span",
            "fk-seat-tabs__meta",
            seatId === "user" ? t(["fateKnots", "seatState", "active"], "Active") : seat.stateText
          )
        );
        seatTabs.append(tab);
      });
      const hero = createRegion("div", "fk-summary-hero", null);
      const portraitAsset = bundle.avatar || createDefaultAsset(null);
      appendImage(
        hero,
        "fk-summary-hero__portrait",
        portraitAsset,
        bundle.avatar ? bundle.avatar.label : createSeatLabel(state, "user")
      );
      const heroBody = createRegion("div", "fk-summary-hero__body", null);
      heroBody.append(
        createElement(
          "strong",
          "fk-summary-hero__title",
          user.nickname || createSeatLabel(state, "user")
        )
      );
      heroBody.append(
        createElement(
          "p",
          "fk-summary-hero__meta",
          [
            bundle.avatar ? bundle.avatar.label : "-",
            bundle.classDef ? bundle.classDef.label : "-",
            bundle.background ? bundle.background.label : "-",
          ].join(" / ")
        )
      );
      if (bundle.classDef) {
        heroBody.append(createElement("p", "fk-summary-hero__meta", formatStats(bundle.classDef)));
        heroBody.append(createElement("p", "fk-summary-hero__meta", formatDeck(bundle.classDef)));
      }
      if (bundle.background && bundle.background.perk) {
        heroBody.append(createElement("p", "fk-summary-hero__meta", bundle.background.perk));
      }
      hero.append(heroBody);
      summary.append(hero);
      const actions = createRegion("div", "fk-action-cluster", "selection-actions");
      const readyLabel = selection.locked
        ? t(["fateKnots", "creation", "locked"], "Build locked")
        : isSelectionComplete(selection)
          ? t(["fateKnots", "controls", "ready"], "Lock Build")
          : t(["fateKnots", "creation", "incomplete"], "Pick an avatar, class, and background.");
      actions.append(
        createActionButton(
          readyLabel,
          "primary",
          selection.locked || !isSelectionComplete(selection),
          function () {
            sendReady(state);
          }
        )
      );
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "reset"], "Reset Run"),
          "secondary",
          false,
          function () {
            sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      summary.append(actions);
      return summary;
    }

    function renderCreationStage(parent, state) {
      const user = getUserParticipant(state);
      const selection = user.selection || createDefaultSelection();
      const layout = createRegion("section", "fk-creation", "creation-layout");
      const table = createRegion("div", "fk-selection-table", "selection-table");
      const intro = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-creation__intro",
        null,
        {
          overlay: getUiAsset("parchmentStain"),
          frame: getUiAsset("mainSceneFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      intro.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "creation", "title"], "Character Creation")
        )
      );
      intro.append(
        createElement(
          "p",
          "fk-frame__hint",
          t(
            ["fateKnots", "creation", "subtitle"],
            "Pick the local build, then lock it so the shared slice can begin."
          )
        )
      );
      table.append(intro);
      renderSelectionFamily(
        table,
        state,
        t(["fateKnots", "creation", "avatarLabel"], "Avatar"),
        state.catalogs.avatars,
        selection.avatarId,
        selection.locked,
        function (value) {
          sendSelection("avatarId", value);
        },
        function (entry) {
          return [entry.summary];
        },
        "avatar"
      );
      renderSelectionFamily(
        table,
        state,
        t(["fateKnots", "creation", "classLabel"], "Class"),
        state.catalogs.classes,
        selection.classId,
        selection.locked,
        function (value) {
          sendSelection("classId", value);
        },
        function (entry) {
          return [formatStats(entry), formatDeck(entry)];
        },
        "class"
      );
      renderSelectionFamily(
        table,
        state,
        t(["fateKnots", "creation", "backgroundLabel"], "Background"),
        state.catalogs.backgrounds,
        selection.backgroundId,
        selection.locked,
        function (value) {
          sendSelection("backgroundId", value);
        },
        function (entry) {
          return [entry.perk || entry.summary];
        },
        "background"
      );
      layout.append(table);
      layout.append(createSelectionSummary(state, selection));
      parent.append(layout);
    }

    function createEvidenceCard(assetLink, label, family) {
      const card = createFrame("div", "fk-evidence-card", null, {
        overlay: getUiAsset("parchmentStain"),
        frame: getUiAsset("cardSlotFrame"),
        texture:
          family === "creature"
            ? getUiAsset("creatureCardTemplate")
            : family === "location"
              ? getUiAsset("locationCardTemplate")
              : getUiAsset("itemCardTemplate"),
      });
      appendImage(card, "fk-evidence-card__image", assetLink, label);
      card.append(createElement("span", "fk-evidence-card__label", label));
      return card;
    }

    function createLogFeed(state) {
      const feed = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--log fk-log-feed",
        "story-feed",
        {
          overlay: getUiAsset("logPanel"),
          frame: getUiAsset("logPanelFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      feed.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "scenario", "logLabel"], "Story Log")
        )
      );
      if (state.scenarioLog.length === 0) {
        feed.append(createElement("p", "fk-frame__hint", getCurrentStatus(state)));
        return feed;
      }
      state.scenarioLog
        .slice()
        .reverse()
        .forEach(function (entry) {
          const item = createFrame("div", "fk-log-feed__entry", null, {
            overlay: getUiAsset("systemMessageBox"),
            frame: getUiAsset("buttonPlate"),
            texture: getUiAsset("darkPanel"),
          });
          item.append(createElement("p", "fk-log-feed__text", entry));
          feed.append(item);
        });
      return feed;
    }

    function createDecisionSurface(state, step) {
      const denominator =
        state.decision &&
        Array.isArray(state.decision.participantIds) &&
        state.decision.participantIds.length > 0
          ? state.decision.participantIds.length
          : state.participants.length;
      const surface = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--decision fk-decision-surface",
        "decision-surface",
        {
          overlay: getUiAsset("notificationBanner"),
          frame: getUiAsset("sidePanelFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      surface.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "scenario", "choicesLabel"], "Common Decision")
        )
      );
      surface.append(
        createSeatRibbon(
          state,
          "scenario-presence",
          state.decision && state.decision.pendingSeatIds && state.decision.pendingSeatIds[0]
            ? state.decision.pendingSeatIds[0]
            : null
        )
      );
      const stack = createRegion("div", "fk-decision-stack", null);
      step.choices.forEach(function (choice) {
        const voteCount = Object.values(state.decision ? state.decision.votes : {}).filter(
          function (value) {
            return value === choice.id;
          }
        ).length;
        const button = createRegion("button", "fk-decision-card", null);
        button.type = "button";
        button.dataset.selected =
          state.decision && state.decision.votes && state.decision.votes.user === choice.id
            ? "true"
            : "false";
        applyFrameArtwork(button, {
          overlay:
            button.dataset.selected === "true"
              ? getUiAsset("cardSelected")
              : getUiAsset("cardHoverGlow"),
          frame: getUiAsset("buttonPlate"),
          texture: getUiAsset("choiceButton"),
        });
        button.append(createElement("strong", "fk-decision-card__title", choice.label));
        button.append(createElement("span", "fk-decision-card__summary", choice.summary || ""));
        button.append(
          createElement(
            "span",
            "fk-decision-card__vote",
            String(voteCount) + "/" + String(denominator)
          )
        );
        button.addEventListener("click", function () {
          sendChoice(state, choice.id);
        });
        stack.append(button);
      });
      surface.append(stack);
      if (state.decision && state.decision.conflict === true) {
        surface.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(
              ["fateKnots", "scenario", "conflict"],
              "Votes conflicted. Sync to re-request the AI seats."
            )
          )
        );
      }
      if (
        state.decision &&
        state.decision.pendingSeatIds &&
        state.decision.pendingSeatIds.length > 0
      ) {
        surface.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(["fateKnots", "scenario", "pending"], "Awaiting") +
              ": " +
              state.decision.pendingSeatIds.join(", ")
          )
        );
      }
      const actions = createRegion("div", "fk-action-cluster", null);
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "sync"], "Sync"),
          "secondary",
          false,
          function () {
            sendSync(state);
          }
        )
      );
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "reset"], "Reset Run"),
          "secondary",
          false,
          function () {
            sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      surface.append(actions);
      return surface;
    }

    function renderNarrativeStage(parent, state) {
      const step = state.currentStep;
      if (!step) {
        parent.append(
          createFrame("section", "fk-stage-frame fk-stage-frame--scene", "scene-shell", {
            overlay: getUiAsset("systemMessageBox"),
            frame: getUiAsset("mainSceneFrame"),
            texture: getUiAsset("darkPanel"),
          })
        );
        return;
      }

      const layout = createRegion("section", "fk-scenario", "scenario-layout");
      const sceneShell = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-scene-shell",
        "scene-shell",
        {
          overlay: getUiAsset("subtleRuneOverlay"),
          frame: getUiAsset("mainSceneFrame"),
          texture: getUiAsset("defaultPanel"),
        }
      );
      const copy = createRegion("div", "fk-scene-shell__copy", null);
      copy.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          step.location && step.location.label
            ? step.location.label
            : t(["fateKnots", "scenario", "mapLabel"], "Map")
        )
      );
      copy.append(createElement("h2", "fk-frame__title", step.title));
      copy.append(createElement("p", "fk-scene-shell__body", step.body));
      if (step.speaker) {
        copy.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(["fateKnots", "scenario", "speaker"], "Speaker") + ": " + step.speaker
          )
        );
      }
      sceneShell.append(copy);
      const visual = createRegion("div", "fk-scene-shell__visual", null);
      appendImage(visual, "fk-scene-shell__image", step.sceneAsset, step.title);
      const anchorRow = createSeatRibbon(state, "scene-presence", null);
      visual.append(anchorRow);
      sceneShell.append(visual);
      if (step.npcs.length || step.items.length || step.creatures.length) {
        const strip = createRegion("div", "fk-evidence-strip", null);
        step.npcs.forEach(function (assetLink) {
          strip.append(createEvidenceCard(assetLink, assetLink.assetId || "NPC", "location"));
        });
        step.items.forEach(function (assetLink) {
          strip.append(createEvidenceCard(assetLink, assetLink.assetId || "Item", "item"));
        });
        step.creatures.forEach(function (assetLink) {
          strip.append(createEvidenceCard(assetLink, assetLink.assetId || "Creature", "creature"));
        });
        sceneShell.append(strip);
      }
      layout.append(sceneShell);

      const lower = createRegion("div", "fk-scenario__lower", null);
      const narrativeRail = createRegion("div", "fk-scenario__rail", null);
      narrativeRail.append(createNarrationPanel(state, "narration-panel"));
      narrativeRail.append(createLogFeed(state));
      lower.append(narrativeRail);
      lower.append(createDecisionSurface(state, step));
      layout.append(lower);
      parent.append(layout);
    }

    function createPartyGrid(state, combat) {
      const grid = createRegion("div", "fk-party-grid", "combat-status");
      combat.party.forEach(function (member) {
        const card = createFrame("article", "fk-party-card", null, {
          overlay: getUiAsset("parchmentStain"),
          frame: getUiAsset("sidePanelFrame"),
          texture: getUiAsset("defaultPanel"),
        });
        setSeatId(card, member.seatId);
        card.append(
          createElement(
            "strong",
            "fk-party-card__title",
            member.nickname || member.seatId || "Seat"
          )
        );
        const selection = member.selection || createDefaultSelection();
        if (selection.avatar && selection.avatar.uiSrc) {
          appendImage(
            card,
            "fk-party-card__portrait",
            selection.avatar,
            member.nickname || member.seatId || "Seat"
          );
        }
        card.append(
          createElement(
            "p",
            "fk-party-card__meta",
            String(member.hp) + "/" + String(member.maxHp) + " HP"
          )
        );
        card.append(
          createElement(
            "p",
            "fk-party-card__meta",
            String(member.energy) + "/" + String(member.maxEnergy) + " EN"
          )
        );
        appendNpcBanter(card, state, member.seatId);
        grid.append(card);
      });
      return grid;
    }

    function createCombatHand(state, combat) {
      const hand = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--decision fk-combat-hand",
        "combat-hand",
        {
          overlay: getUiAsset("notificationBanner"),
          frame: getUiAsset("logPanelFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      hand.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "combat", "actionsLabel"], "Combat Actions")
        )
      );
      const cards = createRegion("div", "fk-combat-hand__cards", null);
      if (combat.availableActions.length > 0) {
        combat.availableActions.forEach(function (action) {
          const button = createRegion("button", "fk-card-choice fk-card-choice--combat", null);
          button.type = "button";
          button.disabled = action.available !== true;
          button.dataset.selected = combat.turn && combat.turn.seatId === "user" ? "true" : "false";
          applyFrameArtwork(button, {
            overlay: button.disabled ? getUiAsset("cardDisabled") : getUiAsset("cardFocusBorder"),
            frame: getUiAsset("cardSlotFrame"),
            texture: getUiAsset("creatureCardTemplate"),
          });
          button.append(createElement("strong", "fk-card-choice__title", action.label));
          button.append(
            createElement(
              "span",
              "fk-card-choice__meta",
              action.type + " • cost " + String(action.cost)
            )
          );
          button.append(createElement("span", "fk-card-choice__meta", action.description || ""));
          button.addEventListener("click", function () {
            sendCombatAction(state, action.id);
          });
          cards.append(button);
        });
      } else {
        cards.append(
          createElement(
            "p",
            "fk-frame__hint",
            t(["fateKnots", "combat", "waitingHint"], "Waiting for the next seat to act.")
          )
        );
      }
      hand.append(cards);
      const actions = createRegion("div", "fk-action-cluster", null);
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "sync"], "Sync"),
          "secondary",
          false,
          function () {
            sendSync(state);
          }
        )
      );
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "reset"], "Reset Run"),
          "secondary",
          false,
          function () {
            sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      hand.append(actions);
      return hand;
    }

    function renderCombatStage(parent, state) {
      const combat = state.combat;
      if (!combat) {
        parent.append(
          createFrame("section", "fk-stage-frame fk-stage-frame--scene", "combat-arena", {
            overlay: getUiAsset("systemMessageBox"),
            frame: getUiAsset("mainSceneFrame"),
            texture: getUiAsset("darkPanel"),
          })
        );
        return;
      }
      const layout = createRegion("section", "fk-combat", "combat-layout");
      const arena = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-combat-arena",
        "combat-arena",
        {
          overlay: getUiAsset("targetRing"),
          frame: getUiAsset("mainSceneFrame"),
          texture: getUiAsset("defaultPanel"),
        }
      );
      arena.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "combat", "enemyLabel"], "Encounter")
        )
      );
      arena.append(createElement("h2", "fk-frame__title", combat.enemy.label || "Enemy"));
      appendImage(
        arena,
        "fk-combat-arena__image",
        combat.enemy.asset,
        combat.enemy.label || "Enemy"
      );
      const arenaStats = createRegion("div", "fk-combat-arena__stats", null);
      arenaStats.append(
        createStatBadge("HP", String(combat.enemy.hp) + "/" + String(combat.enemy.maxHp), "alert")
      );
      arenaStats.append(
        createStatBadge(
          t(["fateKnots", "combat", "roundLabel"], "Round"),
          String(combat.round),
          "warm"
        )
      );
      arenaStats.append(
        createStatBadge(
          t(["fateKnots", "combat", "turnLabel"], "Turn"),
          combat.turn && combat.turn.seatId
            ? combat.turn.seatId
            : t(["fateKnots", "turns", "idle"], "Idle"),
          "soft"
        )
      );
      arena.append(arenaStats);
      arena.append(
        createSeatRibbon(
          state,
          "turn-order",
          combat.turn && combat.turn.seatId ? combat.turn.seatId : null
        )
      );
      layout.append(arena);

      const lower = createRegion("div", "fk-combat__lower", null);
      const status = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--rail fk-combat-status-panel",
        "combat-status",
        {
          overlay: getUiAsset("logPanel"),
          frame: getUiAsset("sidePanelFrame"),
          texture: getUiAsset("darkPanel"),
        }
      );
      status.append(createNarrationPanel(state, "narration-panel"));
      status.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "combat", "partyTitle"], "Field Party")
        )
      );
      status.append(createPartyGrid(state, combat));
      if (combat.recentLog.length > 0) {
        const combatLog = createRegion("div", "fk-combat-log", null);
        combat.recentLog.forEach(function (entry) {
          combatLog.append(createElement("p", "fk-log-feed__text", entry));
        });
        status.append(combatLog);
      }
      lower.append(status);
      lower.append(createCombatHand(state, combat));
      layout.append(lower);
      parent.append(layout);
    }

    function renderResultStage(parent, state) {
      const layout = createRegion("section", "fk-result", "result-layout");
      const resultShell = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--scene fk-result-shell",
        "result-shell",
        {
          overlay: getUiAsset("notificationBanner"),
          frame: getUiAsset("mainSceneFrame"),
          texture: getUiAsset("defaultPanel"),
        }
      );
      resultShell.append(
        createElement("p", "fk-frame__eyebrow", t(["fateKnots", "result", "label"], "Result"))
      );
      resultShell.append(
        createElement(
          "h2",
          "fk-frame__title",
          state.result.title || t(["fateKnots", "result", "titleFallback"], "Run Complete")
        )
      );
      resultShell.append(
        createElement("p", "fk-scene-shell__body", state.result.summary || getCurrentStatus(state))
      );
      if (state.result.continueHint) {
        resultShell.append(createElement("p", "fk-frame__hint", state.result.continueHint));
      }
      resultShell.append(createSeatRibbon(state, "result-ribbon", null));
      resultShell.append(createNarrationPanel(state, "narration-panel"));
      const actions = createRegion("div", "fk-action-cluster", null);
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "reset"], "Reset Run"),
          "primary",
          false,
          function () {
            sendRoomCommand("GameRoomFateKnotsReset", {});
          }
        )
      );
      actions.append(
        createActionButton(
          t(["fateKnots", "controls", "end"], "End Run"),
          "secondary",
          false,
          function () {
            sendRoomCommand("GameRoomFateKnotsEnd", { sessionId: state.sessionId });
          }
        )
      );
      resultShell.append(actions);
      layout.append(resultShell);
      if (state.scenarioLog.length > 0) {
        layout.append(createLogFeed(state));
      }
      parent.append(layout);
    }

    function applySurfaceBackdrop(surface, state) {
      const featureView =
        state.uiAssets && state.uiAssets.featureView
          ? state.uiAssets.featureView
          : createDefaultAsset(null);
      applyAssetLayers(surface, [
        {
          asset: getUiAsset("vignettePatch"),
          size: "cover",
          position: "center",
          blend: "multiply",
        },
        {
          asset: getUiAsset("subtleRuneOverlay"),
          size: "cover",
          position: "center",
          blend: "screen",
        },
        { asset: getUiAsset("fogPatch"), size: "cover", position: "center", blend: "screen" },
        { asset: featureView, size: "cover", position: "center", blend: "normal" },
      ]);
    }

    function createSurfaceCorner(role, asset) {
      const corner = createRegion("div", "fk-surface__corner fk-surface__corner--" + role, null);
      applyFrameArtwork(corner, { texture: asset });
      return corner;
    }

    function renderFateKnots(root) {
      ensureUiAssetsPreloaded();
      const state = getCurrentState();
      const phaseId =
        state.phase === "character-creation"
          ? "character-creation"
          : state.phase === "scenario"
            ? "scenario"
            : state.phase === "combat"
              ? "combat"
              : state.phase === "result"
                ? "result"
                : "overview";
      const shell = createRegion("div", "fk-shell", "shell");
      shell.dataset.fkPhase = phaseId;
      const surface = createRegion("section", "fk-surface", "surface-shell");
      applySurfaceBackdrop(surface, state);
      const inner = createRegion("div", "fk-surface__inner", null);
      if (phaseId !== "overview") {
        inner.append(createTopbar(state, phaseId));
      }
      if (phaseId === "character-creation") {
        renderCreationStage(inner, state);
      } else if (phaseId === "scenario") {
        renderNarrativeStage(inner, state);
      } else if (phaseId === "combat") {
        renderCombatStage(inner, state);
      } else if (phaseId === "result") {
        renderResultStage(inner, state);
      } else {
        renderOverviewStage(inner, state);
      }
      surface.append(createSurfaceCorner("nw", getUiAsset("cornerOrnament")));
      surface.append(createSurfaceCorner("se", getUiAsset("cornerOrnament")));
      surface.append(inner);
      shell.append(surface);
      root.replaceChildren(shell);
    }

    return {
      createFateKnotsState: createFateKnotsState,
      sanitizeFateKnotsState: sanitizeFateKnotsState,
      renderFateKnots: renderFateKnots,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
