export function createGameRoomCommandRegistry(api, deps) {
  return {
    [deps.xoxCommandNames.start](payload) {
      return deps.handleXoxStart(api, payload || {});
    },
    [deps.xoxCommandNames.reset]() {
      return deps.handleXoxReset(api);
    },
    [deps.xoxCommandNames.userMove](payload) {
      return deps.handleXoxUserMove(api, payload || {});
    },
    [deps.xoxCommandNames.aiMove](payload) {
      return deps.handleXoxAiMove(api, payload || {});
    },
    [deps.xoxCommandNames.remoteMove](payload) {
      return deps.handleXoxRemoteMove(api, payload || {});
    },
    [deps.xoxCommandNames.acceptInvite](payload) {
      return deps.handleXoxAcceptInvite(api, payload || {});
    },
    [deps.xoxCommandNames.rejectInvite](payload) {
      return deps.handleXoxRejectInvite(api, payload || {});
    },
    GameRoomTeamTetrisStart(payload) {
      return deps.handleTeamTetrisStart(api, payload || {});
    },
    GameRoomTeamTetrisReset() {
      return deps.handleTeamTetrisReset(api);
    },
    GameRoomTeamTetrisUserMove(payload) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    GameRoomTeamTetrisAiMove(payload) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    GameRoomTeamTetrisRemoteMove(payload) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    [deps.fateKnotsCommandNames.start](payload) {
      return deps.handleFateKnotsStart(api, payload || {});
    },
    [deps.fateKnotsCommandNames.reset]() {
      return deps.handleFateKnotsReset(api);
    },
    [deps.fateKnotsCommandNames.ready]() {
      return deps.handleFateKnotsReady(api);
    },
    [deps.fateKnotsCommandNames.characterSelect](payload) {
      return deps.handleFateKnotsCharacterSelect(api, payload || {});
    },
    [deps.fateKnotsCommandNames.choice](payload) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [deps.fateKnotsCommandNames.combatAction](payload) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [deps.fateKnotsCommandNames.sync](payload) {
      return deps.handleFateKnotsSync(api, payload || {});
    },
    [deps.fateKnotsCommandNames.end]() {
      return deps.handleFateKnotsEnd(api);
    },
    [deps.fateKnotsCommandNames.aiChoice](payload) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [deps.fateKnotsCommandNames.aiCombatAction](payload) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [deps.fateKnotsCommandNames.remoteChoice](payload) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [deps.fateKnotsCommandNames.remoteCombatAction](payload) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [deps.fateKnotsCommandNames.dmPacket](payload) {
      return deps.handleFateKnotsDmPacket(api, payload || {});
    },
    [deps.fateKnotsCommandNames.npcBanter](payload) {
      return deps.handleFateKnotsNpcBanter(api, payload || {});
    }
  };
}
