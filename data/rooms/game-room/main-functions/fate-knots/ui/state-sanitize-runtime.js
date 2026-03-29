(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createFateKnotsUiStateSanitizeRuntime = function createFateKnotsUiStateSanitizeRuntime() {
    const createFateKnotsUiStateDefaultsRuntime = registry.createFateKnotsUiStateDefaultsRuntime;
    if (typeof createFateKnotsUiStateDefaultsRuntime !== "function") {
      throw new Error("Fate Knots state defaults runtime is required.");
    }
    const defaultsRuntime = createFateKnotsUiStateDefaultsRuntime();
    function cloneJsonValue(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function sanitizeAssetLink(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      const asset = source.asset && typeof source.asset === "object" ? source.asset : {};
      const assetId = typeof source.assetId === "string" && source.assetId.trim() ? source.assetId : typeof asset.id === "string" && asset.id.trim() ? asset.id : null;
      const uiSrc = typeof source.uiSrc === "string" && source.uiSrc.trim() ? source.uiSrc : typeof source.src === "string" && source.src.trim() ? source.src : typeof asset.uiSrc === "string" && asset.uiSrc.trim() ? asset.uiSrc : typeof asset.src === "string" && asset.src.trim() ? asset.src : null;
      return {
        ...defaultsRuntime.createDefaultAsset(assetId),
        ...cloneJsonValue(source),
        assetId,
        asset: {
          ...cloneJsonValue(asset),
          id: assetId,
          uiSrc,
          src: uiSrc
        },
        uiSrc,
        src: uiSrc,
        present: Boolean(uiSrc)
      };
    }
    function sanitizeCatalogEntry(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      const fallback = defaultsRuntime.createDefaultCatalogEntry();
      return {
        ...fallback,
        ...cloneJsonValue(source),
        id: typeof source.id === "string" && source.id.trim() ? source.id : fallback.id,
        label: typeof source.label === "string" ? source.label : fallback.label,
        summary: typeof source.summary === "string" ? source.summary : fallback.summary,
        description: typeof source.description === "string" ? source.description : typeof source.summary === "string" ? source.summary : fallback.description,
        perk: typeof source.perk === "string" ? source.perk : fallback.perk,
        stats: source.stats && typeof source.stats === "object" ? cloneJsonValue(source.stats) : fallback.stats,
        startingDeck: Array.isArray(source.startingDeck) ? source.startingDeck.map(String) : [],
        asset: sanitizeAssetLink(source.asset || source)
      };
    }
    function sanitizeSelection(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      const fallback = defaultsRuntime.createDefaultSelection();
      return {
        ...fallback,
        ...cloneJsonValue(source),
        avatarId: typeof source.avatarId === "string" && source.avatarId.trim() ? source.avatarId : fallback.avatarId,
        classId: typeof source.classId === "string" && source.classId.trim() ? source.classId : fallback.classId,
        backgroundId: typeof source.backgroundId === "string" && source.backgroundId.trim() ? source.backgroundId : fallback.backgroundId,
        locked: source.locked === true,
        autoAssigned: source.autoAssigned === true,
        avatar: source.avatar ? sanitizeCatalogEntry(source.avatar) : fallback.avatar,
        class: source.class ? sanitizeCatalogEntry(source.class) : fallback.class,
        background: source.background ? sanitizeCatalogEntry(source.background) : fallback.background
      };
    }
    function sanitizeParticipant(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      const fallback = defaultsRuntime.createDefaultParticipant(source.seatId);
      return {
        ...fallback,
        ...cloneJsonValue(source),
        seatId: typeof source.seatId === "string" && source.seatId.trim() ? source.seatId : fallback.seatId,
        provider: typeof source.provider === "string" && source.provider.trim() ? source.provider : fallback.provider,
        type: typeof source.type === "string" && source.type.trim() ? source.type : fallback.type,
        nickname: typeof source.nickname === "string" ? source.nickname : fallback.nickname,
        ready: source.ready === true,
        connected: source.connected !== false,
        active: source.active !== false,
        selection: sanitizeSelection(source.selection),
        decisionChoiceId: typeof source.decisionChoiceId === "string" && source.decisionChoiceId.trim() ? source.decisionChoiceId : null,
        combat: source.combat && typeof source.combat === "object" ? cloneJsonValue(source.combat) : null
      };
    }
    function sanitizeCurrentStep(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      return {
        ...cloneJsonValue(source),
        id: typeof source.id === "string" && source.id.trim() ? source.id : null,
        title: typeof source.title === "string" ? source.title : "",
        body: typeof source.body === "string" ? source.body : "",
        speaker: typeof source.speaker === "string" ? source.speaker : "",
        location: source.location && typeof source.location === "object" ? cloneJsonValue(source.location) : null,
        sceneAsset: source.sceneAsset ? sanitizeAssetLink(source.sceneAsset) : defaultsRuntime.createDefaultAsset(null),
        npcs: Array.isArray(source.npcs) ? source.npcs.map(sanitizeAssetLink) : [],
        items: Array.isArray(source.items) ? source.items.map(sanitizeAssetLink) : [],
        creatures: Array.isArray(source.creatures) ? source.creatures.map(sanitizeAssetLink) : [],
        choices: Array.isArray(source.choices) ? source.choices.map(cloneJsonValue) : []
      };
    }
    function sanitizeDecision(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      return {
        ...cloneJsonValue(source),
        stepId: typeof source.stepId === "string" && source.stepId.trim() ? source.stepId : null,
        choiceIds: Array.isArray(source.choiceIds) ? source.choiceIds.filter(Boolean).map(String) : [],
        votes: source.votes && typeof source.votes === "object" ? cloneJsonValue(source.votes) : {},
        participantIds: Array.isArray(source.participantIds) ? source.participantIds.filter(Boolean).map(String) : [],
        resolvedChoiceId: typeof source.resolvedChoiceId === "string" && source.resolvedChoiceId.trim() ? source.resolvedChoiceId : null,
        conflict: source.conflict === true,
        pendingSeatIds: Array.isArray(source.pendingSeatIds) ? source.pendingSeatIds.filter(Boolean).map(String) : [],
        deadlineAt: typeof source.deadlineAt === "string" && source.deadlineAt.trim() ? source.deadlineAt : null
      };
    }
    function sanitizeCombat(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      return {
        ...cloneJsonValue(source),
        encounterId: typeof source.encounterId === "string" && source.encounterId.trim() ? source.encounterId : null,
        outcome: typeof source.outcome === "string" ? source.outcome : "pending",
        round: Number.isFinite(source.round) ? source.round : 1,
        turn: source.turn && typeof source.turn === "object" ? cloneJsonValue(source.turn) : null,
        turnId: typeof source.turnId === "string" && source.turnId.trim() ? source.turnId : null,
        party: Array.isArray(source.party) ? source.party.map(function(entry) {
          const member = entry && typeof entry === "object" ? entry : {};
          return {
            ...cloneJsonValue(member),
            selection: sanitizeSelection(member.selection)
          };
        }) : [],
        enemy: source.enemy && typeof source.enemy === "object" ? {
          ...cloneJsonValue(source.enemy),
          asset: sanitizeAssetLink(source.enemy.asset)
        } : { label: "", hp: 0, maxHp: 0, asset: defaultsRuntime.createDefaultAsset(null) },
        recentLog: Array.isArray(source.recentLog) ? source.recentLog.filter(Boolean).map(String) : [],
        availableActions: Array.isArray(source.availableActions) ? source.availableActions.map(function(entry) {
          return cloneJsonValue(entry);
        }) : []
      };
    }
    function sanitizeFateKnotsState(candidate) {
      const source = candidate && typeof candidate === "object" ? candidate : {};
      const fallback = defaultsRuntime.createFateKnotsState();
      return {
        ...fallback,
        ...cloneJsonValue(source),
        featureId: typeof source.featureId === "string" && source.featureId.trim() ? source.featureId : fallback.featureId,
        active: source.active === true,
        phase: typeof source.phase === "string" && source.phase.trim() ? source.phase : fallback.phase,
        statusKey: typeof source.statusKey === "string" ? source.statusKey : fallback.statusKey,
        status: typeof source.status === "string" ? source.status : fallback.status,
        compatibility: source.compatibility && typeof source.compatibility === "object" ? cloneJsonValue(source.compatibility) : cloneJsonValue(fallback.compatibility),
        sessionId: typeof source.sessionId === "string" && source.sessionId.trim() ? source.sessionId : null,
        participantMode: typeof source.participantMode === "string" ? source.participantMode : fallback.participantMode,
        rosterLocked: source.rosterLocked === true,
        participants: Array.isArray(source.participants) ? source.participants.map(sanitizeParticipant) : [],
        excludedSeats: Array.isArray(source.excludedSeats) ? cloneJsonValue(source.excludedSeats) : [],
        waiting: source.waiting && typeof source.waiting === "object" ? cloneJsonValue(source.waiting) : cloneJsonValue(fallback.waiting),
        map: source.map && typeof source.map === "object" ? {
          ...cloneJsonValue(source.map),
          mapAsset: sanitizeAssetLink(source.map.mapAsset),
          nodes: Array.isArray(source.map.nodes) ? cloneJsonValue(source.map.nodes) : []
        } : cloneJsonValue(fallback.map),
        currentStep: source.currentStep ? sanitizeCurrentStep(source.currentStep) : null,
        decision: source.decision ? sanitizeDecision(source.decision) : null,
        combat: source.combat ? sanitizeCombat(source.combat) : null,
        result: source.result && typeof source.result === "object" ? {
          ...cloneJsonValue(fallback.result),
          ...cloneJsonValue(source.result)
        } : cloneJsonValue(fallback.result),
        dmNarration: source.dmNarration && typeof source.dmNarration === "object" ? cloneJsonValue(source.dmNarration) : null,
        npcBanter: source.npcBanter && typeof source.npcBanter === "object" ? cloneJsonValue(source.npcBanter) : null,
        profile: source.profile && typeof source.profile === "object" ? cloneJsonValue(source.profile) : cloneJsonValue(fallback.profile),
        history: Array.isArray(source.history) ? cloneJsonValue(source.history) : [],
        scenarioLog: Array.isArray(source.scenarioLog) ? source.scenarioLog.filter(Boolean).map(String) : [],
        transport: source.transport && typeof source.transport === "object" ? cloneJsonValue(source.transport) : cloneJsonValue(fallback.transport),
        catalogs: source.catalogs && typeof source.catalogs === "object" ? {
          avatars: Array.isArray(source.catalogs.avatars) ? source.catalogs.avatars.map(sanitizeCatalogEntry) : [],
          classes: Array.isArray(source.catalogs.classes) ? source.catalogs.classes.map(sanitizeCatalogEntry) : [],
          backgrounds: Array.isArray(source.catalogs.backgrounds) ? source.catalogs.backgrounds.map(sanitizeCatalogEntry) : []
        } : cloneJsonValue(fallback.catalogs)
      };
    }
    return {
      sanitizeAssetLink,
      sanitizeCatalogEntry,
      sanitizeSelection,
      sanitizeParticipant,
      sanitizeCurrentStep,
      sanitizeDecision,
      sanitizeCombat,
      sanitizeFateKnotsState
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
