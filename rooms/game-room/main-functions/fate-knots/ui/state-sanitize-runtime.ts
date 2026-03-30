(
  function (global: GameRoomUiGlobal) {
    type UnknownRecord = GameRoomUnknownRecord;
    type FateKnotsAssetInfoInput = Partial<GameRoomFateKnotsAssetInfo>;
    type FateKnotsAssetLinkInput = Partial<GameRoomFateKnotsAssetLink> & {
      asset?: FateKnotsAssetInfoInput | null;
    };
    type FateKnotsCatalogEntryInput = Partial<GameRoomFateKnotsCatalogEntry> & {
      asset?: unknown;
    };
    type FateKnotsChoiceInput = Partial<GameRoomFateKnotsChoice>;
    type FateKnotsExcludedSeatInput = Partial<GameRoomFateKnotsExcludedSeatRecord>;
    type FateKnotsMapNodeInput = Partial<GameRoomFateKnotsMapNode> & {
      marker?: Partial<GameRoomFateKnotsMapMarker> | null;
    };
    type FateKnotsHistoryEntryInput = Partial<GameRoomFateKnotsHistoryEntry>;
    type FateKnotsSelectionInput = Partial<GameRoomFateKnotsSelection> & {
      avatar?: unknown;
      class?: unknown;
      background?: unknown;
    };
    type FateKnotsParticipantInput = Partial<GameRoomFateKnotsParticipant> & {
      selection?: unknown;
    };
    type FateKnotsCurrentStepInput = Partial<GameRoomFateKnotsCurrentStep>;
    type FateKnotsDecisionInput = Partial<GameRoomFateKnotsDecision>;
    type FateKnotsCombatPartyMemberInput = Partial<GameRoomFateKnotsCombatPartyMember> & {
      selection?: unknown;
    };
    type FateKnotsCombatEnemyInput = Partial<GameRoomFateKnotsCombatEnemy> & {
      asset?: unknown;
    };
    type FateKnotsCombatInput = Partial<GameRoomFateKnotsCombatState> & {
      turn?: unknown;
      enemy?: unknown;
      party?: unknown[];
      availableActions?: unknown[];
    };
    type FateKnotsUiAssetsInput = Partial<GameRoomFateKnotsUiAssets> & {
      byId?: UnknownRecord | null;
      featureView?: unknown;
    };
    type FateKnotsMapInput = Partial<GameRoomFateKnotsMapState> & {
      mapAsset?: unknown;
      nodes?: unknown[];
    };
    type FateKnotsCatalogsInput = Partial<GameRoomFateKnotsCatalogs> & {
      avatars?: unknown[];
      classes?: unknown[];
      backgrounds?: unknown[];
    };
    type FateKnotsStateInput = Partial<GameRoomFateKnotsState> & {
      compatibility?: unknown;
      waiting?: unknown;
      map?: unknown;
      result?: unknown;
      dmNarration?: unknown;
      npcBanter?: unknown;
      profile?: unknown;
      transport?: unknown;
      catalogs?: unknown;
      currentStep?: unknown;
      decision?: unknown;
      combat?: unknown;
      uiAssets?: unknown;
    };

    function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
      return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
    }

    function readRecord(value: unknown): UnknownRecord | null {
      return value && typeof value === "object" && Array.isArray(value) === false
        ? (value as UnknownRecord)
        : null;
    }

    function readString(value: unknown): string | null {
      return typeof value === "string" ? value : null;
    }

    function readShape<T extends object>(value: unknown): Partial<T> | null {
      return readRecord(value) as Partial<T> | null;
    }

    const registry = getFactoryRegistry(global);

    registry.createFateKnotsUiStateSanitizeRuntime =
      function createFateKnotsUiStateSanitizeRuntime(): GameRoomFateKnotsUiStateSanitizeRuntime {
      const createFateKnotsUiStateDefaultsRuntime = registry.createFateKnotsUiStateDefaultsRuntime;
      if (typeof createFateKnotsUiStateDefaultsRuntime !== "function") {
        throw new Error("Fate Knots state defaults runtime is required.");
      }

      const defaultsRuntime = createFateKnotsUiStateDefaultsRuntime();

      function cloneJsonValue<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
      }

      function sanitizeAssetLink(candidate: unknown): GameRoomFateKnotsAssetLink {
        const source = readShape<FateKnotsAssetLinkInput>(candidate) || {};
        const asset = readShape<FateKnotsAssetInfoInput>(source.asset) || {};
        const assetId =
          typeof source.assetId === "string" && source.assetId.trim() !== ""
            ? source.assetId.trim()
            : typeof asset.id === "string" && asset.id.trim() !== ""
              ? asset.id.trim()
              : null;
        const uiSrc =
          typeof source.uiSrc === "string" && source.uiSrc.trim() !== ""
            ? source.uiSrc.trim()
            : typeof source.src === "string" && source.src.trim() !== ""
              ? source.src.trim()
              : typeof asset.uiSrc === "string" && asset.uiSrc.trim() !== ""
                ? asset.uiSrc.trim()
                : typeof asset.src === "string" && asset.src.trim() !== ""
                  ? asset.src.trim()
                  : null;
        return {
          ...defaultsRuntime.createDefaultAsset(assetId),
          ...cloneJsonValue(source),
          assetId: assetId,
          asset: {
            ...cloneJsonValue(asset),
            id: assetId,
            uiSrc: uiSrc,
            src: uiSrc,
          },
          uiSrc: uiSrc,
          src: uiSrc,
          present: Boolean(uiSrc),
        };
      }

      function sanitizeCatalogEntry(candidate: unknown): GameRoomFateKnotsCatalogEntry {
        const source = readShape<FateKnotsCatalogEntryInput>(candidate) || {};
        const fallback = defaultsRuntime.createDefaultCatalogEntry();
        const stats = readShape<GameRoomFateKnotsStatBlock>(source.stats);
        return {
          ...fallback,
          ...cloneJsonValue(source),
          id: typeof source.id === "string" && source.id.trim() ? source.id : fallback.id,
          label: typeof source.label === "string" ? source.label : fallback.label,
          summary: typeof source.summary === "string" ? source.summary : fallback.summary,
          description:
            typeof source.description === "string"
              ? source.description
              : typeof source.summary === "string"
                ? source.summary
                : fallback.description,
          perk: typeof source.perk === "string" ? source.perk : fallback.perk,
          stats: stats ? cloneJsonValue(stats) : fallback.stats,
          startingDeck: Array.isArray(source.startingDeck) ? source.startingDeck.map(String) : [],
          asset: sanitizeAssetLink(source.asset || source),
        };
      }

      function sanitizeChoice(candidate: unknown): GameRoomFateKnotsChoice {
        const source = readShape<FateKnotsChoiceInput>(candidate) || {};
        const choice: GameRoomFateKnotsChoice = {
          ...cloneJsonValue(source),
          id: typeof source.id === "string" && source.id.trim() ? source.id : "",
          label: typeof source.label === "string" ? source.label : "",
        };
        if (typeof source.summary === "string") {
          choice.summary = source.summary;
        }
        return choice;
      }

      function sanitizeExcludedSeat(candidate: unknown): GameRoomFateKnotsExcludedSeatRecord {
        const source = readShape<FateKnotsExcludedSeatInput>(candidate) || {};
        return {
          ...cloneJsonValue(source),
          seatId: typeof source.seatId === "string" ? source.seatId : "",
          reason: typeof source.reason === "string" && source.reason.trim() ? source.reason : null,
        };
      }

      function sanitizeMapNode(candidate: unknown): GameRoomFateKnotsMapNode {
        const source = readShape<FateKnotsMapNodeInput>(candidate) || {};
        const marker = readShape<GameRoomFateKnotsMapMarker>(source.marker);
        const markerXPct = Number(marker?.xPct);
        const markerYPct = Number(marker?.yPct);
        return {
          ...cloneJsonValue(source),
          id: typeof source.id === "string" && source.id.trim() ? source.id : "",
          label: typeof source.label === "string" ? source.label : "",
          marker: marker
            ? {
                ...cloneJsonValue(marker),
                xPct: Number.isFinite(markerXPct) ? markerXPct : 0,
                yPct: Number.isFinite(markerYPct) ? markerYPct : 0,
              }
            : null,
          connections: Array.isArray(source.connections)
            ? source.connections.filter(Boolean).map(String)
            : [],
        };
      }

      function sanitizeHistoryEntry(candidate: unknown): GameRoomFateKnotsHistoryEntry {
        const source = readShape<FateKnotsHistoryEntryInput>(candidate) || {};
        const historyEntry: GameRoomFateKnotsHistoryEntry = {
          ...cloneJsonValue(source),
        };
        if (typeof source.title === "string") {
          historyEntry.title = source.title;
        }
        if (typeof source.summary === "string") {
          historyEntry.summary = source.summary;
        }
        if ("timestamp" in source) {
          historyEntry.timestamp = source.timestamp;
        }
        return historyEntry;
      }

      function sanitizeSelection(candidate: unknown): GameRoomFateKnotsSelection {
        const source = readShape<FateKnotsSelectionInput>(candidate) || {};
        const fallback = defaultsRuntime.createDefaultSelection();
        return {
          ...fallback,
          ...cloneJsonValue(source),
          avatarId:
            typeof source.avatarId === "string" && source.avatarId.trim()
              ? source.avatarId
              : fallback.avatarId,
          classId:
            typeof source.classId === "string" && source.classId.trim()
              ? source.classId
              : fallback.classId,
          backgroundId:
            typeof source.backgroundId === "string" && source.backgroundId.trim()
              ? source.backgroundId
              : fallback.backgroundId,
          locked: source.locked === true,
          autoAssigned: source.autoAssigned === true,
          avatar: source.avatar ? sanitizeCatalogEntry(source.avatar) : fallback.avatar,
          class: source.class ? sanitizeCatalogEntry(source.class) : fallback.class,
          background: source.background
            ? sanitizeCatalogEntry(source.background)
            : fallback.background,
        };
      }

      function sanitizeParticipant(candidate: unknown): GameRoomFateKnotsParticipant {
        const source = readShape<FateKnotsParticipantInput>(candidate) || {};
        const fallback = defaultsRuntime.createDefaultParticipant(readString(source.seatId));
        const combat = readRecord(source.combat);
        return {
          ...fallback,
          ...cloneJsonValue(source),
          seatId:
            typeof source.seatId === "string" && source.seatId.trim()
              ? source.seatId
              : fallback.seatId,
          provider:
            typeof source.provider === "string" && source.provider.trim()
              ? source.provider
              : fallback.provider,
          type: typeof source.type === "string" && source.type.trim() ? source.type : fallback.type,
          nickname: typeof source.nickname === "string" ? source.nickname : fallback.nickname,
          ready: source.ready === true,
          connected: source.connected !== false,
          active: source.active !== false,
          selection: sanitizeSelection(source.selection),
          decisionChoiceId:
            typeof source.decisionChoiceId === "string" && source.decisionChoiceId.trim()
              ? source.decisionChoiceId
              : null,
          combat: combat ? cloneJsonValue(combat) : null,
        };
      }

      function sanitizeCurrentStep(candidate: unknown): GameRoomFateKnotsCurrentStep {
        const source = readShape<FateKnotsCurrentStepInput>(candidate) || {};
        const location = readShape<GameRoomFateKnotsLocation>(source.location);
        return {
          ...cloneJsonValue(source),
          id: typeof source.id === "string" && source.id.trim() ? source.id : null,
          title: typeof source.title === "string" ? source.title : "",
          body: typeof source.body === "string" ? source.body : "",
          speaker: typeof source.speaker === "string" ? source.speaker : "",
          location: location ? cloneJsonValue(location) : null,
          sceneAsset: source.sceneAsset
            ? sanitizeAssetLink(source.sceneAsset)
            : defaultsRuntime.createDefaultAsset(null),
          npcs: Array.isArray(source.npcs) ? source.npcs.map(sanitizeAssetLink) : [],
          items: Array.isArray(source.items) ? source.items.map(sanitizeAssetLink) : [],
          creatures: Array.isArray(source.creatures) ? source.creatures.map(sanitizeAssetLink) : [],
          choices: Array.isArray(source.choices) ? source.choices.map(sanitizeChoice) : [],
        };
      }

      function sanitizeDecision(candidate: unknown): GameRoomFateKnotsDecision {
        const source = readShape<FateKnotsDecisionInput>(candidate) || {};
        const votes = readShape<Record<string, string | null | undefined>>(source.votes);
        const sanitizedVotes: Record<string, string | null | undefined> = {};

        if (votes) {
          Object.keys(votes).forEach(function (seatId) {
            const value = votes[seatId];
            sanitizedVotes[seatId] =
              typeof value === "string" && value.trim() !== "" ? value : value == null ? null : undefined;
          });
        }

        return {
          ...cloneJsonValue(source),
          stepId: typeof source.stepId === "string" && source.stepId.trim() ? source.stepId : null,
          choiceIds: Array.isArray(source.choiceIds)
            ? source.choiceIds.filter(Boolean).map(String)
            : [],
          votes: sanitizedVotes,
          participantIds: Array.isArray(source.participantIds)
            ? source.participantIds.filter(Boolean).map(String)
            : [],
          resolvedChoiceId:
            typeof source.resolvedChoiceId === "string" && source.resolvedChoiceId.trim()
              ? source.resolvedChoiceId
              : null,
          conflict: source.conflict === true,
          pendingSeatIds: Array.isArray(source.pendingSeatIds)
            ? source.pendingSeatIds.filter(Boolean).map(String)
            : [],
          deadlineAt:
            typeof source.deadlineAt === "string" && source.deadlineAt.trim()
              ? source.deadlineAt
              : null,
        };
      }

      function sanitizeCombatTurn(candidate: unknown): GameRoomFateKnotsCombatTurn {
        const source = readShape<GameRoomFateKnotsCombatTurn>(candidate) || {};
        return {
          ...cloneJsonValue(source),
          seatId: typeof source.seatId === "string" && source.seatId.trim() ? source.seatId : null,
        };
      }

      function sanitizeCombatAction(candidate: unknown): GameRoomFateKnotsCombatAction {
        const source = readShape<GameRoomFateKnotsCombatAction>(candidate) || {};
        const cost = typeof source.cost === "number" ? source.cost : Number(source.cost);
        return {
          ...cloneJsonValue(source),
          id: typeof source.id === "string" && source.id.trim() ? source.id : "",
          label: typeof source.label === "string" ? source.label : "",
          type: typeof source.type === "string" ? source.type : "",
          cost: Number.isFinite(cost) ? cost : 0,
          available: source.available === true,
          description: typeof source.description === "string" ? source.description : "",
        };
      }

      function sanitizeCombatPartyMember(candidate: unknown): GameRoomFateKnotsCombatPartyMember {
        const source = readShape<FateKnotsCombatPartyMemberInput>(candidate) || {};
        const fallbackParticipant = defaultsRuntime.createDefaultParticipant(readString(source.seatId));
        const hp = typeof source.hp === "number" ? source.hp : Number(source.hp);
        const maxHp = typeof source.maxHp === "number" ? source.maxHp : Number(source.maxHp);
        const energy = typeof source.energy === "number" ? source.energy : Number(source.energy);
        const maxEnergy =
          typeof source.maxEnergy === "number" ? source.maxEnergy : Number(source.maxEnergy);
        return {
          ...cloneJsonValue(source),
          seatId: typeof source.seatId === "string" && source.seatId.trim() ? source.seatId : null,
          nickname: typeof source.nickname === "string" ? source.nickname : "",
          hp: Number.isFinite(hp) ? hp : 0,
          maxHp: Number.isFinite(maxHp) ? maxHp : 0,
          energy: Number.isFinite(energy) ? energy : 0,
          maxEnergy: Number.isFinite(maxEnergy) ? maxEnergy : 0,
          selection: sanitizeSelection(source.selection ?? fallbackParticipant.selection),
        };
      }

      function sanitizeCombatEnemy(candidate: unknown): GameRoomFateKnotsCombatEnemy {
        const source = readShape<FateKnotsCombatEnemyInput>(candidate) || {};
        const hp = typeof source.hp === "number" ? source.hp : Number(source.hp);
        const maxHp = typeof source.maxHp === "number" ? source.maxHp : Number(source.maxHp);
        return {
          ...cloneJsonValue(source),
          label: typeof source.label === "string" ? source.label : "",
          hp: Number.isFinite(hp) ? hp : 0,
          maxHp: Number.isFinite(maxHp) ? maxHp : 0,
          asset: sanitizeAssetLink(source.asset),
        };
      }

      function sanitizeCombat(candidate: unknown): GameRoomFateKnotsCombatState {
        const source = readShape<FateKnotsCombatInput>(candidate) || {};
        const round = typeof source.round === "number" ? source.round : Number(source.round);
        return {
          ...cloneJsonValue(source),
          encounterId:
            typeof source.encounterId === "string" && source.encounterId.trim()
              ? source.encounterId
              : null,
          outcome: typeof source.outcome === "string" ? source.outcome : "pending",
          round: Number.isFinite(round) ? round : 1,
          turn: source.turn ? sanitizeCombatTurn(source.turn) : null,
          turnId: typeof source.turnId === "string" && source.turnId.trim() ? source.turnId : null,
          party: Array.isArray(source.party)
            ? source.party.map(sanitizeCombatPartyMember)
            : [],
          enemy: source.enemy
            ? sanitizeCombatEnemy(source.enemy)
            : { label: "", hp: 0, maxHp: 0, asset: defaultsRuntime.createDefaultAsset(null) },
          recentLog: Array.isArray(source.recentLog)
            ? source.recentLog.filter(Boolean).map(String)
            : [],
          availableActions: Array.isArray(source.availableActions)
            ? source.availableActions.map(sanitizeCombatAction)
            : [],
        };
      }

      function sanitizeUiAssets(candidate: unknown): GameRoomFateKnotsUiAssets {
        const source = readShape<FateKnotsUiAssetsInput>(candidate) || {};
        const fallback = defaultsRuntime.createDefaultUiAssets();
        const rawById = readRecord(source.byId) || {};
        const byId: Record<string, GameRoomFateKnotsAssetLink> = {};

        Object.keys(rawById).forEach(function (assetId) {
          byId[assetId] = sanitizeAssetLink(rawById[assetId]);
        });

        return {
          ...fallback,
          ...cloneJsonValue(source),
          byId: byId,
          featureView: byId["fate-knots-view"]
            ? byId["fate-knots-view"]
            : source.featureView
              ? sanitizeAssetLink(source.featureView)
              : fallback.featureView,
        };
      }

      function sanitizeCompatibility(
        candidate: unknown,
        fallback: GameRoomFateKnotsCompatibility
      ): GameRoomFateKnotsCompatibility {
        const source = readShape<GameRoomFateKnotsCompatibility>(candidate) || {};
        return {
          ...cloneJsonValue(fallback),
          ...cloneJsonValue(source),
          mode: typeof source.mode === "string" && source.mode.trim() ? source.mode : fallback.mode,
          reason: typeof source.reason === "string" ? source.reason : fallback.reason,
        };
      }

      function sanitizeWaiting(
        candidate: unknown,
        fallback: GameRoomFateKnotsWaitingState
      ): GameRoomFateKnotsWaitingState {
        const source = readShape<GameRoomFateKnotsWaitingState>(candidate) || {};
        return {
          ...cloneJsonValue(fallback),
          ...cloneJsonValue(source),
          mode: typeof source.mode === "string" && source.mode.trim() ? source.mode : fallback.mode,
          reason: typeof source.reason === "string" ? source.reason : fallback.reason,
          pendingSeatIds: Array.isArray(source.pendingSeatIds)
            ? source.pendingSeatIds.filter(Boolean).map(String)
            : cloneJsonValue(fallback.pendingSeatIds),
          deadlineAt:
            typeof source.deadlineAt === "string" || typeof source.deadlineAt === "number"
              ? source.deadlineAt
              : source.deadlineAt === null
                ? null
                : fallback.deadlineAt,
        };
      }

      function sanitizeMap(
        candidate: unknown,
        fallback: GameRoomFateKnotsMapState
      ): GameRoomFateKnotsMapState {
        const source = readShape<FateKnotsMapInput>(candidate) || {};
        return {
          ...cloneJsonValue(fallback),
          ...cloneJsonValue(source),
          mapAsset: sanitizeAssetLink(source.mapAsset),
          nodes: Array.isArray(source.nodes) ? source.nodes.map(sanitizeMapNode) : [],
          currentLocationId:
            typeof source.currentLocationId === "string" && source.currentLocationId.trim()
              ? source.currentLocationId
              : source.currentLocationId === null
                ? null
                : fallback.currentLocationId,
        };
      }

      function sanitizeProfile(
        candidate: unknown,
        fallback: GameRoomFateKnotsProfile
      ): GameRoomFateKnotsProfile {
        const source = readShape<GameRoomFateKnotsProfile>(candidate) || {};
        const profile: GameRoomFateKnotsProfile = {
          ...cloneJsonValue(fallback),
          ...cloneJsonValue(source),
          avatarId:
            typeof source.avatarId === "string" && source.avatarId.trim()
              ? source.avatarId
              : source.avatarId === null
                ? null
                : fallback.avatarId,
          classId:
            typeof source.classId === "string" && source.classId.trim()
              ? source.classId
              : source.classId === null
                ? null
                : fallback.classId,
          backgroundId:
            typeof source.backgroundId === "string" && source.backgroundId.trim()
              ? source.backgroundId
              : source.backgroundId === null
                ? null
                : fallback.backgroundId,
        };
        if ("updatedAt" in source) {
          profile.updatedAt = source.updatedAt;
        }
        return profile;
      }

      function sanitizeTransport(
        candidate: unknown,
        fallback: GameRoomFateKnotsTransport
      ): GameRoomFateKnotsTransport {
        const source = readShape<GameRoomFateKnotsTransport>(candidate) || {};
        return {
          ...cloneJsonValue(fallback),
          ...cloneJsonValue(source),
          remoteUserId:
            typeof source.remoteUserId === "string" && source.remoteUserId.trim()
              ? source.remoteUserId
              : source.remoteUserId === null
                ? null
                : fallback.remoteUserId,
        };
      }

      function sanitizeCatalogs(
        candidate: unknown,
        fallback: GameRoomFateKnotsCatalogs
      ): GameRoomFateKnotsCatalogs {
        const source = readShape<FateKnotsCatalogsInput>(candidate) || {};
        return {
          ...cloneJsonValue(fallback),
          ...cloneJsonValue(source),
          avatars: Array.isArray(source.avatars) ? source.avatars.map(sanitizeCatalogEntry) : [],
          classes: Array.isArray(source.classes) ? source.classes.map(sanitizeCatalogEntry) : [],
          backgrounds: Array.isArray(source.backgrounds)
            ? source.backgrounds.map(sanitizeCatalogEntry)
            : [],
        };
      }

      function sanitizeFateKnotsState(candidate: unknown): GameRoomFateKnotsState {
        const source = readShape<FateKnotsStateInput>(candidate) || {};
        const fallback = defaultsRuntime.createFateKnotsState();
        const result = readShape<GameRoomFateKnotsResult>(source.result);
        const dmNarration = readShape<GameRoomFateKnotsNarration>(source.dmNarration);
        const npcBanter = readShape<GameRoomFateKnotsNpcBanter>(source.npcBanter);
        return {
          ...fallback,
          ...cloneJsonValue(source),
          featureId:
            typeof source.featureId === "string" && source.featureId.trim()
              ? source.featureId
              : fallback.featureId,
          active: source.active === true,
          phase:
            typeof source.phase === "string" && source.phase.trim() ? source.phase : fallback.phase,
          statusKey: typeof source.statusKey === "string" ? source.statusKey : fallback.statusKey,
          status: typeof source.status === "string" ? source.status : fallback.status,
          compatibility: sanitizeCompatibility(source.compatibility, fallback.compatibility),
          sessionId:
            typeof source.sessionId === "string" && source.sessionId.trim()
              ? source.sessionId
              : null,
          participantMode:
            typeof source.participantMode === "string"
              ? source.participantMode
              : fallback.participantMode,
          rosterLocked: source.rosterLocked === true,
          participants: Array.isArray(source.participants)
            ? source.participants.map(sanitizeParticipant)
            : [],
          excludedSeats: Array.isArray(source.excludedSeats)
            ? source.excludedSeats.map(sanitizeExcludedSeat)
            : [],
          waiting: sanitizeWaiting(source.waiting, fallback.waiting),
          map: sanitizeMap(source.map, fallback.map),
          currentStep: source.currentStep ? sanitizeCurrentStep(source.currentStep) : null,
          decision: source.decision ? sanitizeDecision(source.decision) : null,
          combat: source.combat ? sanitizeCombat(source.combat) : null,
          result: result
            ? {
                ...cloneJsonValue(fallback.result),
                ...cloneJsonValue(result),
              }
            : cloneJsonValue(fallback.result),
          dmNarration: dmNarration ? cloneJsonValue(dmNarration) : null,
          npcBanter: npcBanter ? cloneJsonValue(npcBanter) : null,
          profile: sanitizeProfile(source.profile, fallback.profile),
          history: Array.isArray(source.history) ? source.history.map(sanitizeHistoryEntry) : [],
          scenarioLog: Array.isArray(source.scenarioLog)
            ? source.scenarioLog.filter(Boolean).map(String)
            : [],
          transport: sanitizeTransport(source.transport, fallback.transport),
          catalogs: sanitizeCatalogs(source.catalogs, fallback.catalogs),
          uiAssets: sanitizeUiAssets(source.uiAssets),
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
        sanitizeUiAssets,
        sanitizeFateKnotsState,
      };
    };
  }
)((typeof window !== "undefined" ? window : globalThis) as unknown as GameRoomUiGlobal);
