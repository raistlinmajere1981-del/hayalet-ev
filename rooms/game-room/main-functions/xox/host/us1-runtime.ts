import { createGameRoomXoxUs1InviteRuntime } from "./us1-invite-runtime.js";
import { createGameRoomXoxUs1SyncRuntime } from "./us1-sync-runtime.js";

type XoxUs1InviteRuntimeDeps = Parameters<typeof createGameRoomXoxUs1InviteRuntime>[0];
type XoxUs1InviteRuntime = ReturnType<typeof createGameRoomXoxUs1InviteRuntime>;
type XoxUs1SyncRuntimeDeps = Omit<
  Parameters<typeof createGameRoomXoxUs1SyncRuntime>[0],
  "inviteRuntime"
>;
type XoxUs1SyncRuntime = ReturnType<typeof createGameRoomXoxUs1SyncRuntime>;
type XoxInviteApi = Parameters<XoxUs1InviteRuntime["sendUs1Invite"]>[0];
type XoxUs1Api = Parameters<XoxUs1SyncRuntime["syncUs1Mailbox"]>[0];
type XoxUs1State = Parameters<XoxUs1InviteRuntime["sendUs1Invite"]>[1];
type XoxSyncReason = Parameters<XoxUs1SyncRuntime["syncUs1Mailbox"]>[1];

export function createGameRoomXoxUs1Runtime(deps: XoxUs1InviteRuntimeDeps & XoxUs1SyncRuntimeDeps) {
  const inviteRuntime = createGameRoomXoxUs1InviteRuntime(deps);
  const syncRuntime = createGameRoomXoxUs1SyncRuntime({
    ...deps,
    inviteRuntime: inviteRuntime as unknown as Parameters<
      typeof createGameRoomXoxUs1SyncRuntime
    >[0]["inviteRuntime"],
  });

  const sendUs1Invite = async (api: XoxUs1Api, state: XoxUs1State, inviteNote: string) =>
    inviteRuntime.sendUs1Invite(
      api as unknown as XoxInviteApi,
      state,
      inviteNote,
      syncRuntime.syncUs1Mailbox as unknown as (api: XoxInviteApi, reason: string) => Promise<void>
    );
  const ensureUs1SyncLoop = (api: XoxUs1Api) =>
    syncRuntime.ensureUs1SyncLoop(api, syncRuntime.syncUs1Mailbox);
  const syncUs1Mailbox = (api: XoxUs1Api, reason: XoxSyncReason) =>
    syncRuntime.syncUs1Mailbox(api, reason);

  return {
    applyInviteAcceptedState: (
      api: XoxUs1Api,
      inviteEntry: Parameters<XoxUs1InviteRuntime["applyInviteAcceptedState"]>[1],
      starter: Parameters<XoxUs1InviteRuntime["applyInviteAcceptedState"]>[2]
    ) =>
      inviteRuntime.applyInviteAcceptedState(api as unknown as XoxInviteApi, inviteEntry, starter),
    clearUs1SyncLoop: syncRuntime.clearUs1SyncLoop,
    ensureUs1SyncLoop,
    findInviteById: (api: XoxUs1Api, inviteId: string, remoteUserId: string) =>
      inviteRuntime.findInviteById(api as unknown as XoxInviteApi, inviteId, remoteUserId),
    processRoomCommands: syncRuntime.processRoomCommands,
    processRoomEvents: syncRuntime.processRoomEvents,
    readIncomingInviteStarter: inviteRuntime.readIncomingInviteStarter,
    readOutgoingInviteStarter: inviteRuntime.readOutgoingInviteStarter,
    removeInviteFromInbox: (api: XoxUs1Api, inviteId: string, remoteUserId: string | null) =>
      inviteRuntime.removeInviteFromInbox(
        api as unknown as XoxInviteApi,
        inviteId,
        remoteUserId || ""
      ),
    sendUs1Invite,
    sendUs1Move: inviteRuntime.sendUs1Move,
    sendUs1Reset: inviteRuntime.sendUs1Reset,
    syncFromSnapshot: (api: XoxUs1Api, roomInviteInbox: unknown) =>
      inviteRuntime.syncFromSnapshot(api as unknown as XoxInviteApi, roomInviteInbox),
    syncUs1Mailbox,
  };
}
