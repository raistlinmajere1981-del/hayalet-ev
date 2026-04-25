export const FATE_KNOTS_SCHEMA_VERSION = 1;
export const FATE_KNOTS_STATE_KEY = "fate-knots-game";
export const FATE_KNOTS_CONTENT_STATE_KEY = "fate-knots-content";
export const FATE_KNOTS_PROFILE_STATE_KEY = "fate-knots-profile";
export const FATE_KNOTS_HISTORY_STATE_KEY = "fate-knots-history";
export const FATE_KNOTS_SAVE_SLOT_STATE_KEY = "fate-knots-save-slot";
export const FATE_KNOTS_WAIT_TIMEOUT_MS = 45e3;
export const FATE_KNOTS_MAX_LOG_ENTRIES = 18;
export const FATE_KNOTS_MAX_HISTORY_ENTRIES = 6;
export const FATE_KNOTS_MAX_PACKET_TEXT_LENGTH = 280;
export const FATE_KNOTS_SUPPORTED_AI_SEATS = ["ai1", "ai2"];
export const FATE_KNOTS_SUPPORTED_REMOTE_SEATS = ["us1"];
export const FATE_KNOTS_SELECTION_KEYS = ["avatarId", "classId", "backgroundId"];
export const FATE_KNOTS_PHASES = {
  idle: "idle",
  characterCreation: "character-creation",
  scenario: "scenario",
  combat: "combat",
  result: "result"
};
export const FATE_KNOTS_WAIT_MODES = {
  idle: "idle",
  decision: "decision",
  combat: "combat",
  desync: "desync"
};
export const FATE_KNOTS_COMMAND_NAMES = {
  start: "GameRoomFateKnotsStart",
  reset: "GameRoomFateKnotsReset",
  ready: "GameRoomFateKnotsReady",
  characterSelect: "GameRoomFateKnotsCharacterSelect",
  choice: "GameRoomFateKnotsChoice",
  combatAction: "GameRoomFateKnotsCombatAction",
  sync: "GameRoomFateKnotsSync",
  end: "GameRoomFateKnotsEnd",
  aiChoice: "GameRoomFateKnotsAiChoice",
  aiCombatAction: "GameRoomFateKnotsAiCombatAction",
  remoteChoice: "GameRoomFateKnotsRemoteChoice",
  remoteCombatAction: "GameRoomFateKnotsRemoteCombatAction",
  dmPacket: "GameRoomFateKnotsDmPacket",
  npcBanter: "GameRoomFateKnotsNpcBanter"
};
export const FATE_KNOTS_STATUS_COPY = {
  idle: {
    en: "Choose at least one ready AI seat to begin the Fate Knots skeleton run.",
    tr: "Fate Knots iskelet kosusunu baslatmak icin en az bir hazir AI koltugu secili olmali."
  },
  activeFeatureReset: {
    en: "Leaving Fate Knots safely resets the active skeleton run.",
    tr: "Fate Knots'tan cikmak aktif iskelet kosusunu guvenli sekilde sifirlar."
  },
  characterCreation: {
    en: "Lock the local hero build so the shared scene can begin.",
    tr: "Ortak sahnenin baslamasi icin yerel kahraman secimini kilitle."
  },
  waitingDecision: {
    en: "Waiting for the full party to converge on one shared decision.",
    tr: "Tum ekibin tek bir ortak kararda bulusmasi bekleniyor."
  },
  decisionConflict: {
    en: "Votes conflict. The run stays paused until the party converges again.",
    tr: "Oylar catisti. Ekip yeniden uzlasana kadar kosu beklemede kalir."
  },
  decisionTimeout: {
    en: "A decision reply timed out. Use sync after the delayed seat recovers.",
    tr: "Bir karar yaniti zaman asimina ugradi. Geciken koltuk duzelince sync kullan."
  },
  combatTurnUser: {
    en: "Your turn. Commit one combat card to move the encounter forward.",
    tr: "Sira sende. Catismayi ilerletmek icin bir savas karti sec."
  },
  combatTurnAi: {
    en: "Waiting for an allied seat to submit its combat action.",
    tr: "Bir ekip koltugunun savas hamlesini gondermesi bekleniyor."
  },
  combatTurnRemote: {
    en: "Waiting for the remote ally to submit its combat action.",
    tr: "Uzak ekip arkadasinin savas hamlesi bekleniyor."
  },
  combatTimeout: {
    en: "A combat reply timed out. Use sync after the delayed seat is ready again.",
    tr: "Bir savas yaniti zaman asimina ugradi. Geciken koltuk hazir olunca sync kullan."
  },
  seatUnavailable: {
    en: "A locked participant left the run. The roster stays frozen until sync recovers it.",
    tr: "Kilitli bir katilimci kosudan dustu. Sync toparlayana kadar roster sabit kalir."
  },
  resultVictory: {
    en: "The well entity falls. The Fate Knots skeleton slice is complete.",
    tr: "Kuyu varligi dustu. Fate Knots iskelet dilimi tamamlandi."
  },
  resultDefeat: {
    en: "The party breaks first. Reset to rerun the Fate Knots slice.",
    tr: "Ekip once dagildi. Fate Knots dilimini yeniden denemek icin sifirla."
  },
  remotePending: {
    en: "Waiting for the remote ally to answer from US1 transport.",
    tr: "US1 tasimasindan gelecek uzak ekip cevabi bekleniyor."
  }
};
export const FATE_KNOTS_COMMAND_COPY = {
  started: {
    en: "Fate Knots skeleton run started.",
    tr: "Fate Knots iskelet kosusu baslatildi."
  },
  reset: {
    en: "Fate Knots state reset.",
    tr: "Fate Knots durumu sifirlandi."
  },
  ready: {
    en: "Character locked. The shared journey can move forward.",
    tr: "Karakter kilitlendi. Ortak yolculuk ileri akabilir."
  },
  selectionSaved: {
    en: "Character choice updated.",
    tr: "Karakter secimi guncellendi."
  },
  choiceAccepted: {
    en: "Party vote recorded.",
    tr: "Ekip oyu kaydedildi."
  },
  combatActionAccepted: {
    en: "Combat action applied.",
    tr: "Savas hamlesi uygulandi."
  },
  syncQueued: {
    en: "Pending Fate Knots prompts were re-synced.",
    tr: "Bekleyen Fate Knots istemleri yeniden esitlendi."
  },
  ended: {
    en: "Fate Knots run ended.",
    tr: "Fate Knots kosusu sonlandirildi."
  },
  needReadyCompanions: {
    en: "At least one ready AI companion is required for the V1 Fate Knots slice.",
    tr: "V1 Fate Knots dilimi icin en az bir hazir AI yoldasi gerekli."
  },
  invalidSelection: {
    en: "That character selection is not part of the current content registry.",
    tr: "Bu karakter secimi guncel icerik kaydinda yer almiyor."
  },
  incompleteSelection: {
    en: "Choose an avatar, class, and background before locking the hero.",
    tr: "Kahramani kilitlemeden once avatar, sinif ve gecmis sec."
  },
  notActive: {
    en: "There is no active Fate Knots run.",
    tr: "Aktif bir Fate Knots kosusu yok."
  },
  wrongPhase: {
    en: "That command does not match the current Fate Knots phase.",
    tr: "Bu komut mevcut Fate Knots asamasi ile uyusmuyor."
  },
  invalidChoice: {
    en: "The selected choice is not valid for the current step.",
    tr: "Secilen tercih mevcut adim icin gecerli degil."
  },
  invalidAction: {
    en: "The selected combat action is not valid right now.",
    tr: "Secilen savas hamlesi su anda gecerli degil."
  },
  stalePayload: {
    en: "A stale Fate Knots payload was ignored.",
    tr: "Gec kalmis bir Fate Knots payload'u yoksayildi."
  },
  providerMismatch: {
    en: "That seat is not allowed to act for the current Fate Knots turn.",
    tr: "Bu koltuk mevcut Fate Knots turu icin hamle yapamaz."
  },
  desync: {
    en: "The run is waiting in recovery mode. Use sync after the missing seat is ready again.",
    tr: "Kosu toparlanma modunda bekliyor. Eksik koltuk hazir olunca sync kullan."
  },
  invalidPacket: {
    en: "The additive Fate Knots packet was not valid.",
    tr: "Ek Fate Knots paketi gecersizdi."
  },
  dmPacketAccepted: {
    en: "DM narration packet stored.",
    tr: "DM anlati paketi kaydedildi."
  },
  npcBanterAccepted: {
    en: "NPC banter packet stored.",
    tr: "NPC atismasi paketi kaydedildi."
  }
};
