(function (global: GameRoomUiGlobal) {
  const registry: GameRoomUiFactoriesRegistry =
    global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiStateDefaultsRuntime =
    function createFateKnotsUiStateDefaultsRuntime(): GameRoomFateKnotsUiStateDefaultsRuntime {
      function createDefaultAsset(assetId: string | null): GameRoomFateKnotsAssetLink {
        return {
          assetId,
          asset: {
            id: assetId,
            uiSrc: null,
            src: null,
          },
          uiSrc: null,
          src: null,
          label: "",
          present: false,
        };
      }

      function createDefaultCatalogEntry(): GameRoomFateKnotsCatalogEntry {
        return {
          id: null,
          label: "",
          summary: "",
          description: "",
          perk: "",
          stats: {},
          startingDeck: [],
          asset: createDefaultAsset(null),
        };
      }

      function createDefaultSelection(): GameRoomFateKnotsSelection {
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

      function createDefaultParticipant(seatId: string | null): GameRoomFateKnotsParticipant {
        return {
          seatId,
          provider: seatId,
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

      function createDefaultTransport(): GameRoomFateKnotsTransport {
        return {
          remoteUserId: null,
        };
      }

      function createDefaultResult(): GameRoomFateKnotsResult {
        return {
          outcome: "idle",
          title: "",
          summary: "",
          continueHint: "",
        };
      }

      function createDefaultWaiting(): GameRoomFateKnotsWaitingState {
        return {
          mode: "idle",
          reason: "",
          pendingSeatIds: [],
          deadlineAt: null,
        };
      }

      function createDefaultMap(): GameRoomFateKnotsMapState {
        return {
          mapAsset: createDefaultAsset(null),
          nodes: [],
          currentLocationId: null,
        };
      }

      function createDefaultCatalogs(): GameRoomFateKnotsCatalogs {
        return {
          avatars: [],
          classes: [],
          backgrounds: [],
        };
      }

      function createDefaultUiAssets(): GameRoomFateKnotsUiAssets {
        return {
          byId: {},
          featureView: createDefaultAsset(null),
        };
      }

      function createFateKnotsState(): GameRoomFateKnotsState {
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
})((typeof window !== "undefined" ? window : globalThis) as unknown as GameRoomUiGlobal);
