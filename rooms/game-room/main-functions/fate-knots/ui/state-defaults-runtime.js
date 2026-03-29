(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiStateDefaultsRuntime = function createFateKnotsUiStateDefaultsRuntime() {
    function createDefaultAsset(assetId) {
      return {
        assetId: assetId || null,
        asset: {
          id: assetId || null,
          uiSrc: null,
          src: null,
        },
        uiSrc: null,
        src: null,
        label: "",
        present: false,
      };
    }

    function createDefaultCatalogEntry() {
      return {
        id: null,
        label: "",
        summary: "",
        description: "",
        perk: "",
        stats: null,
        startingDeck: [],
        asset: createDefaultAsset(null),
      };
    }

    function createDefaultSelection() {
      return {
        avatarId: null,
        classId: null,
        backgroundId: null,
        locked: false,
        autoAssigned: false,
        avatar: createDefaultCatalogEntry(),
        class: createDefaultCatalogEntry(),
        background: createDefaultCatalogEntry(),
      };
    }

    function createDefaultParticipant(seatId) {
      return {
        seatId: seatId || null,
        provider: seatId || null,
        type: seatId === "user" ? "local-user" : "ai",
        nickname: seatId || "Seat",
        ready: false,
        connected: false,
        active: false,
        selection: createDefaultSelection(),
        decisionChoiceId: null,
        combat: null,
      };
    }

    function createDefaultTransport() {
      return {
        remoteUserId: null,
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

    function createDefaultWaiting() {
      return {
        mode: "idle",
        reason: "",
        pendingSeatIds: [],
        deadlineAt: null,
      };
    }

    function createDefaultMap() {
      return {
        mapAsset: createDefaultAsset(null),
        nodes: [],
        currentLocationId: null,
      };
    }

    function createDefaultCatalogs() {
      return {
        avatars: [],
        classes: [],
        backgrounds: [],
      };
    }

    function createFateKnotsState() {
      return {
        roomId: "game-room",
        featureId: "fate-knots",
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
        participants: [],
        excludedSeats: [],
        waiting: createDefaultWaiting(),
        map: createDefaultMap(),
        currentStep: null,
        decision: null,
        combat: null,
        result: createDefaultResult(),
        dmNarration: null,
        npcBanter: null,
        profile: {
          avatarId: null,
          classId: null,
          backgroundId: null,
          updatedAt: null,
        },
        history: [],
        scenarioLog: [],
        transport: createDefaultTransport(),
        catalogs: createDefaultCatalogs(),
        assetCoverage: {},
      };
    }

    return {
      createDefaultAsset,
      createDefaultCatalogEntry,
      createDefaultParticipant,
      createDefaultResult,
      createDefaultSelection,
      createDefaultTransport,
      createFateKnotsState,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
