(function(global) {
  const registry = global.GameRoomUiFeatureContract || (global.GameRoomUiFeatureContract = {});
  const FEATURE_ID = "xox";
  const TEAM_TETRIS_FEATURE_ID = "team-tetris";
  const FATE_KNOTS_FEATURE_ID = "fate-knots";
  const FEATURE_RECORDS = [
    {
      id: FEATURE_ID,
      name: "XOX",
      description: ""
    },
    {
      id: TEAM_TETRIS_FEATURE_ID,
      name: "Team Tetris",
      description: ""
    },
    {
      id: FATE_KNOTS_FEATURE_ID,
      name: "Fate Knots",
      description: ""
    }
  ];
  const BOOTSTRAP_COPY = {
    en: {
      roomTitle: "Game Room",
      loadingTitle: "Loading Game Room",
      loadingBody: "Waiting for room context and translations.",
      userLabel: "User",
      roomApiUnavailable: "Room API bridge is not connected.",
      commandSendFailed: "The command could not be sent to the room host."
    },
    tr: {
      roomTitle: "Oyun Odasi",
      loadingTitle: "Oyun Odasi Yukleniyor",
      loadingBody: "Oda baglami ve ceviriler bekleniyor.",
      userLabel: "Kullanici",
      roomApiUnavailable: "Room API koprusu bagli degil.",
      commandSendFailed: "Komut oda host'una gonderilemedi."
    }
  };
  function cloneFeatureRecords() {
    return FEATURE_RECORDS.map((feature) => ({ ...feature }));
  }
  function cloneBootstrapCopy() {
    return {
      en: { ...BOOTSTRAP_COPY["en"] },
      tr: { ...BOOTSTRAP_COPY["tr"] }
    };
  }
  registry.ROOM_ID = "game-room";
  registry.FEATURE_ID = FEATURE_ID;
  registry.TEAM_TETRIS_FEATURE_ID = TEAM_TETRIS_FEATURE_ID;
  registry.FATE_KNOTS_FEATURE_ID = FATE_KNOTS_FEATURE_ID;
  registry.getFeatureRecords = function getFeatureRecords() {
    return cloneFeatureRecords();
  };
  registry.getBootstrapCopy = function getBootstrapCopy() {
    return cloneBootstrapCopy();
  };
})(window);
