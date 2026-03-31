(function(global) {
  function getFactoryRegistry(host) {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }
  function readFeatureState(value) {
    return value && typeof value === "object" && Array.isArray(value) === false ? value : null;
  }
  const registry = getFactoryRegistry(global);
  registry.createFateKnotsUiStateSupportRuntime = function createFateKnotsUiStateSupportRuntime(deps) {
    const getState = deps.getState;
    const featureId = deps.featureId || "fate-knots";
    const sendRoomCommand = deps.sendRoomCommand;
    const text = deps.text;
    function t(path, fallback) {
      return text(path, fallback);
    }
    function getCurrentState() {
      const state = getState();
      const featureState = readFeatureState(state[featureId]);
      return featureState || state.fateKnots;
    }
    function getLocale() {
      const state = getState();
      return typeof state.locale === "string" && state.locale ? state.locale : "en";
    }
    function getCurrentStatus(state) {
      return state?.status || "";
    }
    function findParticipant(state, seatId) {
      if (!state) {
        return null;
      }
      return state.participants.find(function(participant) {
        return participant.seatId === seatId;
      }) || null;
    }
    function getUserParticipant(state) {
      return findParticipant(state, "user");
    }
    function isSelectionComplete(selection) {
      return Boolean(
        selection && selection.avatarId && selection.classId && selection.backgroundId
      );
    }
    function resolveCatalogEntry(list, id, fallback) {
      if (!id) {
        return fallback;
      }
      return list.find(function(entry) {
        return entry.id === id;
      }) || fallback;
    }
    function normalizeSelectionEntry(entry) {
      return entry && typeof entry.id === "string" && entry.id.trim() ? entry : null;
    }
    function getSelectionBundle(state, participant) {
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
        )
      };
    }
    function sendSelection(fieldName, value) {
      return sendRoomCommand("GameRoomFateKnotsCharacterSelect", {
        [fieldName]: value
      });
    }
    function sendReady(state) {
      return sendRoomCommand("GameRoomFateKnotsReady", {
        sessionId: state.sessionId
      });
    }
    function sendChoice(state, choiceId) {
      return sendRoomCommand("GameRoomFateKnotsChoice", {
        sessionId: state.sessionId,
        stepId: state.decision?.stepId || state.currentStep?.id || null,
        choiceId
      });
    }
    function sendCombatAction(state, actionId) {
      return sendRoomCommand("GameRoomFateKnotsCombatAction", {
        sessionId: state.sessionId,
        encounterId: state.combat?.encounterId || null,
        turnId: state.combat?.turnId || null,
        actionId
      });
    }
    function sendSync(state) {
      return sendRoomCommand("GameRoomFateKnotsSync", {
        sessionId: state.sessionId
      });
    }
    function formatMetricValue(value) {
      return Number.isFinite(value) ? String(value) : "--";
    }
    function formatStats(entry) {
      const stats = entry?.stats;
      if (!entry || !stats) {
        return "";
      }
      return [
        stats.maxHp != null ? "HP " + formatMetricValue(stats.maxHp) : null,
        stats.attack != null ? "ATK " + formatMetricValue(stats.attack) : null,
        stats.defense != null ? "DEF " + formatMetricValue(stats.defense) : null,
        stats.speed != null ? "SPD " + formatMetricValue(stats.speed) : null,
        stats.energy != null || stats.maxEnergy != null ? "EN " + formatMetricValue(stats.energy != null ? stats.energy : stats.maxEnergy) : null
      ].filter(Boolean).join(" • ");
    }
    function formatDeck(entry) {
      const cards = Array.isArray(entry?.startingDeck) ? entry.startingDeck : [];
      return cards.length > 0 ? cards.join(" • ") : "";
    }
    function formatDeadline(deadlineAt) {
      if (!deadlineAt) {
        return "";
      }
      return new Date(deadlineAt).toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    function formatHistoryTimestamp(timestamp) {
      if (!timestamp) {
        return "";
      }
      return new Date(timestamp).toLocaleString(getLocale(), {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    function getPhaseLabel(phaseId) {
      const labels = {
        idle: t(["fateKnots", "phase", "overview"], "Gathering"),
        overview: t(["fateKnots", "phase", "overview"], "Gathering"),
        "character-creation": t(["fateKnots", "phase", "characterCreation"], "Preparation"),
        scenario: t(["fateKnots", "phase", "scenario"], "Omen"),
        combat: t(["fateKnots", "phase", "combat"], "Clash"),
        result: t(["fateKnots", "phase", "result"], "Aftermath")
      };
      return labels[phaseId] || phaseId.replace(/-/g, " ");
    }
    return {
      findParticipant,
      formatDeck,
      formatDeadline,
      formatHistoryTimestamp,
      formatStats,
      getCurrentState,
      getCurrentStatus,
      getPhaseLabel,
      getSelectionBundle,
      getUserParticipant,
      isSelectionComplete,
      sendChoice,
      sendCombatAction,
      sendReady,
      sendSelection,
      sendSync,
      t
    };
  };
})(window);
