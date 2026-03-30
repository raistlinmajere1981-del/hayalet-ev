(function (global: GameRoomUiGlobal) {
  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  function readFeatureState(value: unknown): GameRoomFateKnotsState | null {
    return value && typeof value === "object" && Array.isArray(value) === false
      ? (value as GameRoomFateKnotsState)
      : null;
  }

  const registry = getFactoryRegistry(global);

  registry.createFateKnotsUiStateSupportRuntime = function createFateKnotsUiStateSupportRuntime(
    deps: GameRoomFateKnotsUiStateRuntimeDeps
  ): GameRoomFateKnotsUiStateSupportRuntime {
    const getState = deps.getState;
    const featureId = deps.featureId || "fate-knots";
    const sendRoomCommand = deps.sendRoomCommand;
    const text = deps.text;

    function t(path: string[], fallback: string): string {
      return text(path, fallback);
    }

    function getCurrentState(): GameRoomFateKnotsState | null {
      const state = getState();
      const featureState = readFeatureState((state as GameRoomUnknownRecord)[featureId]);
      return featureState || state.fateKnots;
    }

    function getLocale(): string {
      const state = getState();
      return typeof state.locale === "string" && state.locale ? state.locale : "en";
    }

    function getCurrentStatus(state: GameRoomFateKnotsState | null): string {
      return state?.status || "";
    }

    function findParticipant(
      state: GameRoomFateKnotsState | null,
      seatId: string
    ): GameRoomFateKnotsParticipant | null {
      if (!state) {
        return null;
      }
      return (
        state.participants.find(function (participant: GameRoomFateKnotsParticipant) {
          return participant.seatId === seatId;
        }) || null
      );
    }

    function getUserParticipant(
      state: GameRoomFateKnotsState | null
    ): GameRoomFateKnotsParticipant | null {
      return findParticipant(state, "user");
    }

    function isSelectionComplete(
      selection: GameRoomFateKnotsSelection | null | undefined
    ): boolean {
      return Boolean(
        selection && selection.avatarId && selection.classId && selection.backgroundId
      );
    }

    function resolveCatalogEntry(
      list: GameRoomFateKnotsCatalogEntry[],
      id: string | null,
      fallback: GameRoomFateKnotsCatalogEntry | null
    ): GameRoomFateKnotsCatalogEntry | null {
      if (!id) {
        return fallback;
      }
      return (
        list.find(function (entry: GameRoomFateKnotsCatalogEntry) {
          return entry.id === id;
        }) || fallback
      );
    }

    function normalizeSelectionEntry(
      entry: GameRoomFateKnotsCatalogEntry | null
    ): GameRoomFateKnotsCatalogEntry | null {
      return entry && typeof entry.id === "string" && entry.id.trim() ? entry : null;
    }

    function getSelectionBundle(
      state: GameRoomFateKnotsState | null,
      participant: GameRoomFateKnotsParticipant | null
    ): GameRoomFateKnotsSelectionBundle {
      const selection = participant?.selection || null;
      const catalogs = state?.catalogs;
      return {
        avatar: normalizeSelectionEntry(
          resolveCatalogEntry(
            catalogs?.avatars || [],
            selection?.avatarId || null,
            selection?.avatar || null
          )
        ),
        classDef: normalizeSelectionEntry(
          resolveCatalogEntry(
            catalogs?.classes || [],
            selection?.classId || null,
            selection?.class || null
          )
        ),
        background: normalizeSelectionEntry(
          resolveCatalogEntry(
            catalogs?.backgrounds || [],
            selection?.backgroundId || null,
            selection?.background || null
          )
        ),
      };
    }

    function sendSelection(fieldName: string, value: unknown): unknown {
      return sendRoomCommand("GameRoomFateKnotsCharacterSelect", {
        [fieldName]: value,
      });
    }

    function sendReady(state: GameRoomFateKnotsState): unknown {
      return sendRoomCommand("GameRoomFateKnotsReady", {
        sessionId: state.sessionId,
      });
    }

    function sendChoice(state: GameRoomFateKnotsState, choiceId: string): unknown {
      return sendRoomCommand("GameRoomFateKnotsChoice", {
        sessionId: state.sessionId,
        stepId: state.decision?.stepId || state.currentStep?.id || null,
        choiceId: choiceId,
      });
    }

    function sendCombatAction(state: GameRoomFateKnotsState, actionId: string): unknown {
      return sendRoomCommand("GameRoomFateKnotsCombatAction", {
        sessionId: state.sessionId,
        encounterId: state.combat?.encounterId || null,
        turnId: state.combat?.turnId || null,
        actionId: actionId,
      });
    }

    function sendSync(state: GameRoomFateKnotsState): unknown {
      return sendRoomCommand("GameRoomFateKnotsSync", {
        sessionId: state.sessionId,
      });
    }

    function formatMetricValue(value: unknown): string {
      return Number.isFinite(value) ? String(value) : "--";
    }

    function formatStats(entry: GameRoomFateKnotsCatalogEntry | null | undefined): string {
      const stats = entry?.stats;
      if (!entry || !stats) {
        return "";
      }
      return [
        stats.maxHp != null ? "HP " + formatMetricValue(stats.maxHp) : null,
        stats.attack != null ? "ATK " + formatMetricValue(stats.attack) : null,
        stats.defense != null ? "DEF " + formatMetricValue(stats.defense) : null,
        stats.speed != null ? "SPD " + formatMetricValue(stats.speed) : null,
        stats.energy != null || stats.maxEnergy != null
          ? "EN " + formatMetricValue(stats.energy != null ? stats.energy : stats.maxEnergy)
          : null,
      ]
        .filter(Boolean)
        .join(" \u2022 ");
    }

    function formatDeck(entry: GameRoomFateKnotsCatalogEntry | null | undefined): string {
      const cards = Array.isArray(entry?.startingDeck) ? entry.startingDeck : [];
      return cards.length > 0 ? cards.join(" \u2022 ") : "";
    }

    function formatDeadline(deadlineAt: unknown): string {
      if (!deadlineAt) {
        return "";
      }
      return new Date(deadlineAt as string | number).toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function formatHistoryTimestamp(timestamp: unknown): string {
      if (!timestamp) {
        return "";
      }
      return new Date(timestamp as string | number).toLocaleString(getLocale(), {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function getPhaseLabel(phaseId: string): string {
      const labels: Record<string, string> = {
        idle: t(["fateKnots", "phase", "overview"], "Gathering"),
        overview: t(["fateKnots", "phase", "overview"], "Gathering"),
        "character-creation": t(["fateKnots", "phase", "characterCreation"], "Preparation"),
        scenario: t(["fateKnots", "phase", "scenario"], "Omen"),
        combat: t(["fateKnots", "phase", "combat"], "Clash"),
        result: t(["fateKnots", "phase", "result"], "Aftermath"),
      };
      return labels[phaseId] || phaseId.replace(/-/g, " ");
    }

    return {
      findParticipant: findParticipant,
      formatDeck: formatDeck,
      formatDeadline: formatDeadline,
      formatHistoryTimestamp: formatHistoryTimestamp,
      formatStats: formatStats,
      getCurrentState: getCurrentState,
      getCurrentStatus: getCurrentStatus,
      getPhaseLabel: getPhaseLabel,
      getSelectionBundle: getSelectionBundle,
      getUserParticipant: getUserParticipant,
      isSelectionComplete: isSelectionComplete,
      sendChoice: sendChoice,
      sendCombatAction: sendCombatAction,
      sendReady: sendReady,
      sendSelection: sendSelection,
      sendSync: sendSync,
      t: t,
    };
  };
})(window as unknown as GameRoomUiGlobal);
