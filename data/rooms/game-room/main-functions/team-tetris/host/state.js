import { readLocale } from "../../../shared/host/context-state.js";
import { normalizeLocale, normalizeText } from "../../../shared/host/text.js";
import { TEAM_TETRIS_SCHEMA_VERSION, cloneTeamTetrisMatch } from "./engine.js";
export const TEAM_TETRIS_STATUS_COPY = {
  idle: {
    en: "Waiting for AI1, AI2, and US1 before Team Tetris can start.",
    tr: "Takim Tetris baslamadan once AI1, AI2 ve US1 bekleniyor."
  },
  ready: {
    en: "All required seats are ready. The Team Tetris opener can be seeded.",
    tr: "Gerekli tum koltuklar hazir. Takim Tetris acilis turu tohumlanabilir."
  },
  activeFeatureReset: {
    en: "Leaving the Team Tetris feature resets the active Team Tetris match.",
    tr: "Takim Tetris ozelliginden cikmak aktif Takim Tetris macini sifirlar."
  },
  notImplemented: {
    en: "The Team Tetris host shell is online. Gameplay turns unlock in the next sprint.",
    tr: "Takim Tetris host shell'i hazir. Oynanis turleri sonraki sprintte acilacak."
  },
  blockedOpponent: {
    en: "A required seat disconnected during Team Tetris. Reset to start again.",
    tr: "Gerekli bir koltuk Takim Tetris sirasinda baglantidan dustu. Yeniden baslamak icin sifirla."
  },
  blockedDispatch: {
    en: "The latest Team Tetris state could not be delivered. Reset to try again.",
    tr: "Guncel Takim Tetris durumu iletilemedi. Tekrar denemek icin sifirla."
  },
  blockedInvalidMove: {
    en: "An invalid Team Tetris move was returned. Reset to recover.",
    tr: "Gecersiz bir Takim Tetris hamlesi dondu. Kurtarmak icin sifirla."
  }
};
export const TEAM_TETRIS_COMMAND_COPY = {
  started: {
    en: "Team Tetris match started.",
    tr: "Takim Tetris maci baslatildi."
  },
  reset: {
    en: "Team Tetris state reset.",
    tr: "Takim Tetris durumu sifirlandi."
  },
  needReadySeats: {
    en: "AI1, AI2, and US1 must all be ready before Team Tetris can start.",
    tr: "Takim Tetris baslamadan once AI1, AI2 ve US1 hazir olmali."
  },
  notImplemented: {
    en: "Team Tetris turn execution is not available in this sprint yet.",
    tr: "Takim Tetris tur yurutme bu sprintte henuz aktif degil."
  },
  noActiveGame: {
    en: "There is no active Team Tetris match.",
    tr: "Aktif bir Takim Tetris maci yok."
  },
  blockedMatch: {
    en: "This Team Tetris match is blocked. Reset to continue.",
    tr: "Bu Takim Tetris maci bloke. Devam etmek icin sifirla."
  },
  notUserTurn: {
    en: "It is not the local user's Team Tetris turn.",
    tr: "Takim Tetris turu yerel kullanicida degil."
  },
  providerMismatch: {
    en: "The Team Tetris move came from a different seat than the active turn.",
    tr: "Takim Tetris hamlesi aktif turdan farkli bir koltuktan geldi."
  },
  invalidMove: {
    en: "The Team Tetris move was invalid.",
    tr: "Takim Tetris hamlesi gecersizdi."
  },
  moveApplied: {
    en: "Team Tetris move applied.",
    tr: "Takim Tetris hamlesi uygulandi."
  },
  staleRemoteMove: {
    en: "A stale Team Tetris remote move was ignored.",
    tr: "Gec kalan Takim Tetris uzak hamlesi yoksayildi."
  },
  duplicateRemoteMove: {
    en: "A duplicate Team Tetris remote move was ignored.",
    tr: "Yinelenen Takim Tetris uzak hamlesi yoksayildi."
  },
  dispatchFailed: {
    en: "The Team Tetris update could not be delivered.",
    tr: "Takim Tetris guncellemesi iletilemedi."
  }
};
export function createInitialTeamTetrisState(locale) {
  return {
    locale: normalizeLocale(locale),
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    active: false,
    result: "idle",
    statusKey: "idle",
    hiddenPairs: true,
    revealPairsOnFinish: true,
    blockedReason: "",
    matchId: null,
    match: null,
    localSessionId: null,
    remoteUserId: null,
    lastRemoteTransportMessageId: null,
    lastRemoteTurnIndex: null
  };
}
export function normalizeTeamTetrisState(candidate, localeFallback) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const state = createInitialTeamTetrisState(source.locale || localeFallback);
  state.schemaVersion = TEAM_TETRIS_SCHEMA_VERSION;
  state.active = source.active === true;
  state.result = typeof source.result === "string" && source.result.trim() !== "" ? source.result.trim() : "idle";
  state.statusKey = typeof source.statusKey === "string" && Object.prototype.hasOwnProperty.call(TEAM_TETRIS_STATUS_COPY, source.statusKey) ? source.statusKey : "idle";
  state.hiddenPairs = source.hiddenPairs !== false;
  state.revealPairsOnFinish = source.revealPairsOnFinish !== false;
  state.blockedReason = normalizeText(source.blockedReason);
  state.matchId = normalizeText(source.matchId) || null;
  state.match = cloneTeamTetrisMatch(source.match);
  state.localSessionId = normalizeText(source.localSessionId) || null;
  state.remoteUserId = normalizeText(source.remoteUserId) || null;
  state.lastRemoteTransportMessageId = normalizeText(source.lastRemoteTransportMessageId) || null;
  state.lastRemoteTurnIndex = typeof source.lastRemoteTurnIndex === "number" && Number.isInteger(source.lastRemoteTurnIndex) && source.lastRemoteTurnIndex >= 0 ? source.lastRemoteTurnIndex : null;
  if (state.match) {
    state.matchId = state.match.matchId || state.matchId;
    if (state.result !== "blocked") {
      state.result = state.match.result || state.result;
      state.active = state.match.result === "pending";
    }
    state.hiddenPairs = state.match.hiddenPairs !== false;
    state.revealPairsOnFinish = state.match.revealPairsOnFinish !== false;
  }
  return state;
}
export function loadTeamTetrisState(api) {
  return normalizeTeamTetrisState(api.getState("team-tetris-game"), readLocale(api));
}
export function saveTeamTetrisState(api, state) {
  const normalized = normalizeTeamTetrisState(state, readLocale(api));
  normalized.locale = readLocale(api);
  api.setState("team-tetris-game", normalized);
  return normalized;
}
