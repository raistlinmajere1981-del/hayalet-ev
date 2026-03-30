(function (global: any) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiStateDefaultsRuntime =
    function createFateKnotsUiStateDefaultsRuntime() {
      function createDefaultAsset(assetId: any) {
        return {
          assetId: (assetId ?? null) as string | null,
          asset: {
            id: (assetId ?? null) as string | null,
            uiSrc: null as string | null,
            src: null as string | null,
          },
          uiSrc: null as string | null,
          src: null as string | null,
          label: "",
          present: false,
        };
      }

      function createDefaultCatalogEntry() {
        return {
          id: null as string | null,
          label: "",
          summary: "",
          description: "",
          perk: "",
          stats: null as unknown,
          startingDeck: [] as unknown[],
          asset: createDefaultAsset(null),
        };
      }

      function createDefaultSelection() {
        return {
          avatarId: null as string | null,
          classId: null as string | null,
          backgroundId: null as string | null,
          locked: false,
          autoAssigned: false,
          avatar: createDefaultCatalogEntry(),
          class: createDefaultCatalogEntry(),
          background: createDefaultCatalogEntry(),
        };
      }

      function createDefaultParticipant(seatId: any) {
        return {
          seatId: seatId || null,
          provider: seatId || null,
          type: seatId === "user" ? "local-user" : "ai",
          nickname: seatId || "Seat",
          ready: false,
          connected: false,
          active: false,
          selection: createDefaultSelection(),
          decisionChoiceId: null as string | null,
          combat: null as unknown,
        };
      }

      function createDefaultTransport() {
        return {
          remoteUserId: null as string | null,
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
          pendingSeatIds: [] as string[],
          deadlineAt: null as number | null,
        };
      }

      function createDefaultMap() {
        return {
          mapAsset: createDefaultAsset(null),
          nodes: [] as unknown[],
          currentLocationId: null as string | null,
        };
      }

      function createDefaultCatalogs() {
        return {
          avatars: [] as unknown[],
          classes: [] as unknown[],
          backgrounds: [] as unknown[],
        };
      }

      function createDefaultUiAssets() {
        return {
          byId: {},
          featureView: createDefaultAsset(null),
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
          sessionId: null as string | null,
          participantMode: "user-plus-ready-ai",
          rosterLocked: false,
          participants: [] as unknown[],
          excludedSeats: [] as unknown[],
          waiting: createDefaultWaiting(),
          map: createDefaultMap(),
          currentStep: null as unknown,
          decision: null as unknown,
          combat: null as unknown,
          result: createDefaultResult(),
          dmNarration: null as unknown,
          npcBanter: null as unknown,
          profile: {
            avatarId: null as string | null,
            classId: null as string | null,
            backgroundId: null as string | null,
            updatedAt: null as string | null,
          },
          history: [] as unknown[],
          scenarioLog: [] as unknown[],
          transport: createDefaultTransport(),
          catalogs: createDefaultCatalogs(),
          assetCoverage: {},
          uiAssets: createDefaultUiAssets(),
        };
      }

      return {
        createDefaultAsset,
        createDefaultCatalogEntry,
        createDefaultParticipant,
        createDefaultResult,
        createDefaultSelection,
        createDefaultTransport,
        createDefaultUiAssets,
        createFateKnotsState,
      };
    };
})(typeof window !== "undefined" ? window : globalThis);
