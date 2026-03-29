(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

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
      if (state && state[featureId]) {
        return state[featureId];
      }
      if (state && state.fateKnots) {
        return state.fateKnots;
      }
      return null;
    }

    function getLocale() {
      const state = getState();
      return (state && typeof state.locale === "string" && state.locale) || "en";
    }

    function getCurrentStatus(state) {
      return (state && state.status) || "";
    }

    function findParticipant(state, seatId) {
      if (!state || !Array.isArray(state.participants)) {
        return null;
      }
      return (
        state.participants.find(function (participant) {
          return participant.seatId === seatId;
        }) || null
      );
    }

    function getUserParticipant(state) {
      return findParticipant(state, "user");
    }

    function isSelectionComplete(selection) {
      return Boolean(selection && selection.avatarId && selection.classId && selection.backgroundId);
    }

    function resolveCatalogEntry(list, id, fallback) {
      if (!Array.isArray(list)) {
        return fallback;
      }
      return (
        list.find(function (entry) {
          return entry.id === id;
        }) || fallback
      );
    }

    function getSelectionBundle(state, participant) {
      const selection = (participant && participant.selection) || {};
      const catalogs = (state && state.catalogs) || {};
      return {
        avatar: resolveCatalogEntry(catalogs.avatars, selection.avatarId, selection.avatar || null),
        classDef: resolveCatalogEntry(catalogs.classes, selection.classId, selection.class || null),
        background: resolveCatalogEntry(
          catalogs.backgrounds,
          selection.backgroundId,
          selection.background || null
        ),
      };
    }

    function sendSelection(fieldName, value) {
      return sendRoomCommand("GameRoomFateKnotsCharacterSelect", {
        [fieldName]: value,
      });
    }

    function sendReady(state) {
      return sendRoomCommand("GameRoomFateKnotsReady", {
        sessionId: state.sessionId,
      });
    }

    function sendChoice(state, choiceId) {
      return sendRoomCommand("GameRoomFateKnotsChoice", {
        sessionId: state.sessionId,
        stepId:
          (state.decision && state.decision.stepId) ||
          (state.currentStep && state.currentStep.id) ||
          null,
        choiceId: choiceId,
      });
    }

    function sendCombatAction(state, actionId) {
      return sendRoomCommand("GameRoomFateKnotsCombatAction", {
        sessionId: state.sessionId,
        encounterId: state.combat && state.combat.encounterId ? state.combat.encounterId : null,
        turnId: state.combat && state.combat.turnId ? state.combat.turnId : null,
        actionId: actionId,
      });
    }

    function sendSync(state) {
      return sendRoomCommand("GameRoomFateKnotsSync", {
        sessionId: state.sessionId,
      });
    }

    function formatMetricValue(value) {
      return Number.isFinite(value) ? String(value) : "--";
    }

    function formatStats(entry) {
      if (!entry) {
        return "";
      }
      const stats = entry.stats && typeof entry.stats === "object" ? entry.stats : entry;
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
        .join(" • ");
    }

    function formatDeck(entry) {
      const cards = Array.isArray(entry && entry.startingDeck)
        ? entry.startingDeck
        : Array.isArray(entry && entry.deck)
          ? entry.deck
          : [];
      return cards.length > 0 ? cards.join(" • ") : "";
    }

    function formatDeadline(deadlineAt) {
      if (!deadlineAt) {
        return "";
      }
      return new Date(deadlineAt).toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit",
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
        minute: "2-digit",
      });
    }

    function getPhaseLabel(phaseId) {
      const labels = {
        overview: t(["fateKnots", "phase", "overview"], "Gathering"),
        "character-creation": t(["fateKnots", "phase", "characterCreation"], "Preparation"),
        scenario: t(["fateKnots", "phase", "scenario"], "Omen"),
        combat: t(["fateKnots", "phase", "combat"], "Clash"),
        result: t(["fateKnots", "phase", "result"], "Aftermath"),
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
      t,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
