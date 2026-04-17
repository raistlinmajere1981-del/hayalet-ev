export function createGameRoomCommandRegistry(api, deps) {
  const xoxCommands = {
    start: deps.xoxCommandNames["start"] || "GameRoomXoxStart",
    reset: deps.xoxCommandNames["reset"] || "GameRoomXoxReset",
    userMove: deps.xoxCommandNames["userMove"] || "GameRoomXoxUserMove",
    aiMove: deps.xoxCommandNames["aiMove"] || "GameRoomXoxAiMove",
    remoteMove: deps.xoxCommandNames["remoteMove"] || "GameRoomXoxRemoteMove",
    acceptInvite: deps.xoxCommandNames["acceptInvite"] || "GameRoomXoxAcceptInvite",
    rejectInvite: deps.xoxCommandNames["rejectInvite"] || "GameRoomXoxRejectInvite"
  };
  const fateKnotsCommands = {
    start: deps.fateKnotsCommandNames["start"] || "GameRoomFateKnotsStart",
    reset: deps.fateKnotsCommandNames["reset"] || "GameRoomFateKnotsReset",
    ready: deps.fateKnotsCommandNames["ready"] || "GameRoomFateKnotsReady",
    characterSelect: deps.fateKnotsCommandNames["characterSelect"] || "GameRoomFateKnotsCharacterSelect",
    choice: deps.fateKnotsCommandNames["choice"] || "GameRoomFateKnotsChoice",
    combatAction: deps.fateKnotsCommandNames["combatAction"] || "GameRoomFateKnotsCombatAction",
    sync: deps.fateKnotsCommandNames["sync"] || "GameRoomFateKnotsSync",
    end: deps.fateKnotsCommandNames["end"] || "GameRoomFateKnotsEnd",
    aiChoice: deps.fateKnotsCommandNames["aiChoice"] || "GameRoomFateKnotsAiChoice",
    aiCombatAction: deps.fateKnotsCommandNames["aiCombatAction"] || "GameRoomFateKnotsAiCombatAction",
    remoteChoice: deps.fateKnotsCommandNames["remoteChoice"] || "GameRoomFateKnotsRemoteChoice",
    remoteCombatAction: deps.fateKnotsCommandNames["remoteCombatAction"] || "GameRoomFateKnotsRemoteCombatAction",
    dmPacket: deps.fateKnotsCommandNames["dmPacket"] || "GameRoomFateKnotsDmPacket",
    npcBanter: deps.fateKnotsCommandNames["npcBanter"] || "GameRoomFateKnotsNpcBanter"
  };
  return {
    [xoxCommands.start]: function(payload) {
      return deps.handleXoxStart(api, payload || {});
    },
    [xoxCommands.reset]: function() {
      return deps.handleXoxReset(api);
    },
    [xoxCommands.userMove]: function(payload) {
      return deps.handleXoxUserMove(api, payload || {});
    },
    [xoxCommands.aiMove]: function(payload) {
      return deps.handleXoxAiMove(api, payload || {});
    },
    [xoxCommands.remoteMove]: function(payload) {
      return deps.handleXoxRemoteMove(api, payload || {});
    },
    [xoxCommands.acceptInvite]: function(payload) {
      return deps.handleXoxAcceptInvite(api, payload || {});
    },
    [xoxCommands.rejectInvite]: function(payload) {
      return deps.handleXoxRejectInvite(api, payload || {});
    },
    GameRoomTeamTetrisStart: function(payload) {
      return deps.handleTeamTetrisStart(api, payload || {});
    },
    GameRoomTeamTetrisReset: function() {
      return deps.handleTeamTetrisReset(api);
    },
    GameRoomTeamTetrisUserMove: function(payload) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    GameRoomTeamTetrisAiMove: function(payload) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    GameRoomTeamTetrisRemoteMove: function(payload) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    [fateKnotsCommands.start]: function(payload) {
      return deps.handleFateKnotsStart(api, payload || {});
    },
    [fateKnotsCommands.reset]: function() {
      return deps.handleFateKnotsReset(api);
    },
    [fateKnotsCommands.ready]: function() {
      return deps.handleFateKnotsReady(api);
    },
    [fateKnotsCommands.characterSelect]: function(payload) {
      return deps.handleFateKnotsCharacterSelect(api, payload || {});
    },
    [fateKnotsCommands.choice]: function(payload) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [fateKnotsCommands.combatAction]: function(payload) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [fateKnotsCommands.sync]: function(payload) {
      return deps.handleFateKnotsSync(api, payload || {});
    },
    [fateKnotsCommands.end]: function() {
      return deps.handleFateKnotsEnd(api);
    },
    [fateKnotsCommands.aiChoice]: function(payload) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [fateKnotsCommands.aiCombatAction]: function(payload) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [fateKnotsCommands.remoteChoice]: function(payload) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [fateKnotsCommands.remoteCombatAction]: function(payload) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [fateKnotsCommands.dmPacket]: function(payload) {
      return deps.handleFateKnotsDmPacket(api, payload || {});
    },
    [fateKnotsCommands.npcBanter]: function(payload) {
      return deps.handleFateKnotsNpcBanter(api, payload || {});
    }
  };
}
