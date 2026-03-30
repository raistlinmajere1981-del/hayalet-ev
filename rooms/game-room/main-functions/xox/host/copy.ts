import type { XoxGameState } from "./state-core.js";
import { getOpponentInfo } from "./state.js";
import { fillTemplate, translate } from "../../../shared/host/text.js";
import type {
  GameRoomContextState,
  GameRoomSlotState,
} from "../../../shared/types/room-shell-contracts.js";

function readOpponentInfo(context: GameRoomContextState, state: XoxGameState): GameRoomSlotState {
  return getOpponentInfo(context, state);
}

export function commandMessage(locale: unknown, key: string, params: Record<string, unknown> = {}) {
  const messages = {
    started: {
      en: "XOX match started.",
      tr: "XOX maci baslatildi.",
    },
    inviteSent: {
      en: "XOX invite sent to the remote opponent.",
      tr: "Uzak rakibe XOX daveti gonderildi.",
    },
    reset: {
      en: "XOX match reset.",
      tr: "XOX maci sifirlandi.",
    },
    needReadyOpponent: {
      en: "The selected opponent is not ready.",
      tr: "Secilen rakip hazir degil.",
    },
    pendingInviteExists: {
      en: "There is already a pending remote invite. Reset first if you want to start over.",
      tr: "Bekleyen bir uzak davet zaten var. Basa donmek icin once sifirla.",
    },
    noActiveGame: {
      en: "There is no active XOX match.",
      tr: "Aktif bir XOX maci yok.",
    },
    blockedGame: {
      en: "This match is blocked. Reset to start again.",
      tr: "Bu mac bloke oldu. Yeniden baslamak icin sifirla.",
    },
    notUserTurn: {
      en: "It is not the user's turn.",
      tr: "Sira kullanicida degil.",
    },
    invalidCell: {
      en: "Choose a valid board cell from 0 to 8.",
      tr: "0 ile 8 arasinda gecerli bir tahta hucresi sec.",
    },
    cellFilled: {
      en: "That cell is already filled.",
      tr: "Bu hucre zaten dolu.",
    },
    moveSent: {
      en: "Move applied and sent to the opponent.",
      tr: "Hamle uygulandi ve rakibe gonderildi.",
    },
    aiTurnOnly: {
      en: "The room is not waiting for an opponent move.",
      tr: "Oda su an bir rakip hamlesi beklemiyor.",
    },
    providerMismatch: {
      en: "The move came from a different opponent than the active match.",
      tr: "Hamle aktif mactakinden farkli bir rakipten geldi.",
    },
    inviteMismatch: {
      en: "The invite does not match the active XOX match.",
      tr: "Davet bilgisi aktif XOX maci ile eslesmiyor.",
    },
    aiInvalidMove: {
      en: "The opponent sent an invalid move.",
      tr: "Rakip gecersiz bir hamle gonderdi.",
    },
    aiFilledCell: {
      en: "The opponent tried to play into a filled cell.",
      tr: "Rakip dolu bir hucreye oynamaya calisti.",
    },
    dispatchFailed: {
      en: "The board update could not be sent to the opponent.",
      tr: "Tahta guncellemesi rakibe gonderilemedi.",
    },
    inviteNotFound: {
      en: "The selected invite is no longer available.",
      tr: "Secilen davet artik kullanilabilir degil.",
    },
    inviteAcceptFailed: {
      en: "The invite could not be accepted.",
      tr: "Davet kabul edilemedi.",
    },
    inviteRejectFailed: {
      en: "The invite could not be rejected.",
      tr: "Davet reddedilemedi.",
    },
    inviteAccepted: {
      en: "The invite was accepted and the match is ready.",
      tr: "Davet kabul edildi ve mac hazir.",
    },
    inviteRejected: {
      en: "The invite was rejected.",
      tr: "Davet reddedildi.",
    },
    staleRemoteMove: {
      en: "A stale remote move was ignored.",
      tr: "Gec kalan uzak hamle yoksayildi.",
    },
    duplicateRemoteMove: {
      en: "A duplicate remote move was ignored.",
      tr: "Yinelenen uzak hamle yoksayildi.",
    },
    resetRemoteFailed: {
      en: "Local reset applied, but the remote side could not be notified.",
      tr: "Yerel sifirlama uygulandi, ancak uzak tarafa bildirim gonderilemedi.",
    },
    incomingInviteToast: {
      en: "{opponent} sent a new XOX invite.",
      tr: "{opponent} yeni bir XOX daveti gonderdi.",
    },
  };
  return fillTemplate(translate(locale, messages, key), params);
}

export function buildAiTurnMessage(state: XoxGameState, context: GameRoomContextState) {
  const opponent = readOpponentInfo(context, state);
  const availableCells = state.board
    .map(function (_cell: string, index: number) {
      return state.board[index] === "" ? String(index) : "";
    })
    .filter(Boolean)
    .join(", ");
  const boardAscii = state.board
    .reduce(function (acc: string[][], value: string, index: number) {
      const row = Math.floor(index / 3);
      if (!acc[row]) {
        acc[row] = [];
      }
      acc[row].push(value === "" ? String(index) : value);
      return acc;
    }, [])
    .map(function (row: string[]) {
      return row.join(" | ");
    })
    .join("\n---------\n");
  const userName = context.user.nickname;
  const starterLabel = state.starter === "ai" ? opponent.nickname : userName;

  return [
    "XOX turn update from the Game Room.",
    "Game: XOX.",
    "Your reply is parsed from only the latest assistant message.",
    'Use exactly one command line in this format: ++cmd:GameRoomXoxAiMove({"cell":4})',
    "Do not add markdown, prose, code fences, or a second command.",
    "",
    "Match setup:",
    "- Opponent: " + userName,
    "- Starter: " + starterLabel,
    "- You are playing as " + state.aiSymbol + ".",
    "- The user is playing as " + state.userSymbol + ".",
    "",
    "Board:",
    boardAscii,
    "",
    "Open cells: " + (availableCells === "" ? "none" : availableCells),
    "Current turn: " + opponent.nickname + " (" + state.aiSymbol + ")",
    "If the board is finished, do not send a command.",
  ].join("\n");
}

export function buildInviteId() {
  return `xox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildUs1InviteText(
  state: XoxGameState,
  context: GameRoomContextState,
  note: string
) {
  const opponent = readOpponentInfo(context, state);
  const starterLabel = state.starter === "ai" ? opponent.nickname : context.user.nickname;
  const parts = [];

  if (note !== "") {
    parts.push(note, "");
  }

  parts.push(
    "XOX invite from the Game Room.",
    "Opponent: " + context.user.nickname,
    "Starter: " + starterLabel,
    "Accept or reject the invite from the Game Room UI."
  );

  return parts.join("\n");
}

export function buildUs1InviteResponseText(
  type: string,
  inviteEntry: { matchId?: string; inviteId?: string }
) {
  const opener = type === "accept" ? "XOX invite accepted." : "XOX invite rejected.";
  return [opener, "Match ID: " + (inviteEntry.matchId || inviteEntry.inviteId)].join("\n");
}

export function buildUs1ResetText(matchId: string) {
  return ["XOX match reset.", "Match ID: " + matchId].join("\n");
}

export function buildUs1MoveText(
  matchId: string,
  turnIndex: number,
  boardHashBeforeMove: string,
  cell: number
) {
  return `++cmd:GameRoomXoxRemoteMove(${JSON.stringify({
    matchId: matchId,
    inviteId: matchId,
    turnIndex: turnIndex,
    boardHashBeforeMove: boardHashBeforeMove,
    cell: cell,
  })})`;
}
