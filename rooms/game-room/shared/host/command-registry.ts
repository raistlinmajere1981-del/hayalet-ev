type CommandHandler = (api: unknown, payload?: unknown) => unknown;

interface GameRoomCommandRegistryDependencies {
  xoxCommandNames: Record<string, string>;
  handleXoxStart: CommandHandler;
  handleXoxReset: (api: unknown) => unknown;
  handleXoxUserMove: CommandHandler;
  handleXoxAiMove: CommandHandler;
  handleXoxRemoteMove: CommandHandler;
  handleXoxAcceptInvite: CommandHandler;
  handleXoxRejectInvite: CommandHandler;
  handleTeamTetrisStart: CommandHandler;
  handleTeamTetrisReset: (api: unknown) => unknown;
  handleTeamTetrisMove: CommandHandler;
  fateKnotsCommandNames: Record<string, string>;
  handleFateKnotsStart: CommandHandler;
  handleFateKnotsReset: (api: unknown) => unknown;
  handleFateKnotsReady: (api: unknown) => unknown;
  handleFateKnotsCharacterSelect: CommandHandler;
  handleFateKnotsChoice: CommandHandler;
  handleFateKnotsCombatAction: CommandHandler;
  handleFateKnotsSync: CommandHandler;
  handleFateKnotsEnd: (api: unknown) => unknown;
  handleFateKnotsDmPacket: CommandHandler;
  handleFateKnotsNpcBanter: CommandHandler;
}

export function createGameRoomCommandRegistry(
  api: unknown,
  deps: GameRoomCommandRegistryDependencies
): Record<string, (payload?: unknown) => unknown> {
  const xoxCommands = {
    start: deps.xoxCommandNames["start"] || "GameRoomXoxStart",
    reset: deps.xoxCommandNames["reset"] || "GameRoomXoxReset",
    userMove: deps.xoxCommandNames["userMove"] || "GameRoomXoxUserMove",
    aiMove: deps.xoxCommandNames["aiMove"] || "GameRoomXoxAiMove",
    remoteMove: deps.xoxCommandNames["remoteMove"] || "GameRoomXoxRemoteMove",
    acceptInvite: deps.xoxCommandNames["acceptInvite"] || "GameRoomXoxAcceptInvite",
    rejectInvite: deps.xoxCommandNames["rejectInvite"] || "GameRoomXoxRejectInvite",
  };
  const fateKnotsCommands = {
    start: deps.fateKnotsCommandNames["start"] || "GameRoomFateKnotsStart",
    reset: deps.fateKnotsCommandNames["reset"] || "GameRoomFateKnotsReset",
    ready: deps.fateKnotsCommandNames["ready"] || "GameRoomFateKnotsReady",
    characterSelect:
      deps.fateKnotsCommandNames["characterSelect"] || "GameRoomFateKnotsCharacterSelect",
    choice: deps.fateKnotsCommandNames["choice"] || "GameRoomFateKnotsChoice",
    combatAction:
      deps.fateKnotsCommandNames["combatAction"] || "GameRoomFateKnotsCombatAction",
    sync: deps.fateKnotsCommandNames["sync"] || "GameRoomFateKnotsSync",
    end: deps.fateKnotsCommandNames["end"] || "GameRoomFateKnotsEnd",
    aiChoice: deps.fateKnotsCommandNames["aiChoice"] || "GameRoomFateKnotsAiChoice",
    aiCombatAction:
      deps.fateKnotsCommandNames["aiCombatAction"] || "GameRoomFateKnotsAiCombatAction",
    remoteChoice:
      deps.fateKnotsCommandNames["remoteChoice"] || "GameRoomFateKnotsRemoteChoice",
    remoteCombatAction:
      deps.fateKnotsCommandNames["remoteCombatAction"] || "GameRoomFateKnotsRemoteCombatAction",
    dmPacket: deps.fateKnotsCommandNames["dmPacket"] || "GameRoomFateKnotsDmPacket",
    npcBanter: deps.fateKnotsCommandNames["npcBanter"] || "GameRoomFateKnotsNpcBanter",
  };

  return {
    [xoxCommands.start]: function (payload?: unknown) {
      return deps.handleXoxStart(api, payload || {});
    },
    [xoxCommands.reset]: function () {
      return deps.handleXoxReset(api);
    },
    [xoxCommands.userMove]: function (payload?: unknown) {
      return deps.handleXoxUserMove(api, payload || {});
    },
    [xoxCommands.aiMove]: function (payload?: unknown) {
      return deps.handleXoxAiMove(api, payload || {});
    },
    [xoxCommands.remoteMove]: function (payload?: unknown) {
      return deps.handleXoxRemoteMove(api, payload || {});
    },
    [xoxCommands.acceptInvite]: function (payload?: unknown) {
      return deps.handleXoxAcceptInvite(api, payload || {});
    },
    [xoxCommands.rejectInvite]: function (payload?: unknown) {
      return deps.handleXoxRejectInvite(api, payload || {});
    },
    GameRoomTeamTetrisStart: function (payload?: unknown) {
      return deps.handleTeamTetrisStart(api, payload || {});
    },
    GameRoomTeamTetrisReset: function () {
      return deps.handleTeamTetrisReset(api);
    },
    GameRoomTeamTetrisUserMove: function (payload?: unknown) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    GameRoomTeamTetrisAiMove: function (payload?: unknown) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    GameRoomTeamTetrisRemoteMove: function (payload?: unknown) {
      return deps.handleTeamTetrisMove(api, payload || {});
    },
    [fateKnotsCommands.start]: function (payload?: unknown) {
      return deps.handleFateKnotsStart(api, payload || {});
    },
    [fateKnotsCommands.reset]: function () {
      return deps.handleFateKnotsReset(api);
    },
    [fateKnotsCommands.ready]: function () {
      return deps.handleFateKnotsReady(api);
    },
    [fateKnotsCommands.characterSelect]: function (payload?: unknown) {
      return deps.handleFateKnotsCharacterSelect(api, payload || {});
    },
    [fateKnotsCommands.choice]: function (payload?: unknown) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [fateKnotsCommands.combatAction]: function (payload?: unknown) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [fateKnotsCommands.sync]: function (payload?: unknown) {
      return deps.handleFateKnotsSync(api, payload || {});
    },
    [fateKnotsCommands.end]: function () {
      return deps.handleFateKnotsEnd(api);
    },
    [fateKnotsCommands.aiChoice]: function (payload?: unknown) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [fateKnotsCommands.aiCombatAction]: function (payload?: unknown) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [fateKnotsCommands.remoteChoice]: function (payload?: unknown) {
      return deps.handleFateKnotsChoice(api, payload || {});
    },
    [fateKnotsCommands.remoteCombatAction]: function (payload?: unknown) {
      return deps.handleFateKnotsCombatAction(api, payload || {});
    },
    [fateKnotsCommands.dmPacket]: function (payload?: unknown) {
      return deps.handleFateKnotsDmPacket(api, payload || {});
    },
    [fateKnotsCommands.npcBanter]: function (payload?: unknown) {
      return deps.handleFateKnotsNpcBanter(api, payload || {});
    },
  };
}
