/* global window */

(function (global: GameRoomUiGlobal) {
  const registry: GameRoomUiFeatureContractLike =
    global.GameRoomUiFeatureContract || (global.GameRoomUiFeatureContract = {});

  const GAME_ROOM_HOME_FEATURE_ID = "game-room-home";
  const FEATURE_ID = "backgammon";
  const TEAM_TETRIS_FEATURE_ID = "team-tetris";
  const YAHTZEE_FEATURE_ID = "yahtzee";
  const FATE_KNOTS_FEATURE_ID = "fate-knots";

  const FEATURE_RECORDS: GameRoomFeatureRecord[] = [
    {
      id: GAME_ROOM_HOME_FEATURE_ID,
      name: "Game Room",
      description: "",
    },
    {
      id: FEATURE_ID,
      name: "Tavla",
      description: "",
    },
    {
      id: TEAM_TETRIS_FEATURE_ID,
      name: "Team Tetris",
      description: "",
    },
    {
      id: YAHTZEE_FEATURE_ID,
      name: "Yahtzee",
      description: "",
    },
    {
      id: FATE_KNOTS_FEATURE_ID,
      name: "Fate Knots",
      description: "",
    },
  ];

  const BOOTSTRAP_COPY: GameRoomBootstrapCopy = {
    en: {
      roomTitle: "Game Room",
      homeTitle: "Game Room",
      homeBody: "Choose a game from the room when you are ready.",
      loadingTitle: "Loading Game Room",
      loadingBody: "Waiting for room context and translations.",
      userLabel: "User",
      roomApiUnavailable: "Room API bridge is not connected.",
      commandSendFailed: "The command could not be sent to the room host.",
    },
    tr: {
      roomTitle: "Oyun Odası",
      homeTitle: "Oyun Odası",
      homeBody: "Hazır olduğunda odadan oynamak istediğin oyunu seç.",
      loadingTitle: "Oyun Odası Yükleniyor",
      loadingBody: "Oda bağlamı ve çeviriler bekleniyor.",
      userLabel: "Kullanıcı",
      roomApiUnavailable: "Room API köprüsü bağlı değil.",
      commandSendFailed: "Komut oda host'una gönderilemedi.",
    },
  };

  function cloneFeatureRecords(): GameRoomFeatureRecord[] {
    return FEATURE_RECORDS.map((feature) => ({ ...feature }));
  }

  function cloneBootstrapCopy(): GameRoomBootstrapCopy {
    return {
      en: { ...BOOTSTRAP_COPY["en"] },
      tr: { ...BOOTSTRAP_COPY["tr"] },
    };
  }

  registry.ROOM_ID = "game-room";
  registry.FEATURE_ID = FEATURE_ID;
  registry.TEAM_TETRIS_FEATURE_ID = TEAM_TETRIS_FEATURE_ID;
  (registry as GameRoomUiFeatureContractLike & { GAME_ROOM_HOME_FEATURE_ID?: string })
    .GAME_ROOM_HOME_FEATURE_ID = GAME_ROOM_HOME_FEATURE_ID;
  (registry as GameRoomUiFeatureContractLike & { FATE_KNOTS_FEATURE_ID?: string }).FATE_KNOTS_FEATURE_ID =
    FATE_KNOTS_FEATURE_ID;
  registry.getFeatureRecords = function getFeatureRecords() {
    return cloneFeatureRecords();
  };
  registry.getBootstrapCopy = function getBootstrapCopy() {
    return cloneBootstrapCopy();
  };
})(window as unknown as GameRoomUiGlobal);
