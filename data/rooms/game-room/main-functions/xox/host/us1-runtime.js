import { createGameRoomXoxUs1InviteRuntime } from "./us1-invite-runtime.js";
import { createGameRoomXoxUs1SyncRuntime } from "./us1-sync-runtime.js";
export function createGameRoomXoxUs1Runtime(deps) {
  const inviteRuntime = createGameRoomXoxUs1InviteRuntime(deps);
  const syncRuntime = createGameRoomXoxUs1SyncRuntime({
    ...deps,
    inviteRuntime
  });
  const sendUs1Invite = async (api, state, inviteNote) => inviteRuntime.sendUs1Invite(api, state, inviteNote, syncRuntime.syncUs1Mailbox);
  const ensureUs1SyncLoop = (api) => syncRuntime.ensureUs1SyncLoop(api, syncRuntime.syncUs1Mailbox);
  return {
    applyInviteAcceptedState: inviteRuntime.applyInviteAcceptedState,
    clearUs1SyncLoop: syncRuntime.clearUs1SyncLoop,
    ensureUs1SyncLoop,
    findInviteById: inviteRuntime.findInviteById,
    processRoomCommands: syncRuntime.processRoomCommands,
    processRoomEvents: syncRuntime.processRoomEvents,
    readIncomingInviteStarter: inviteRuntime.readIncomingInviteStarter,
    readOutgoingInviteStarter: inviteRuntime.readOutgoingInviteStarter,
    removeInviteFromInbox: inviteRuntime.removeInviteFromInbox,
    sendUs1Invite,
    sendUs1Move: inviteRuntime.sendUs1Move,
    sendUs1Reset: inviteRuntime.sendUs1Reset,
    syncFromSnapshot: inviteRuntime.syncFromSnapshot,
    syncUs1Mailbox: syncRuntime.syncUs1Mailbox
  };
}
