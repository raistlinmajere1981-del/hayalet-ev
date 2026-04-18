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
type XoxUs1InviteApiAdapter = (api: XoxUs1Api) => XoxInviteApi;

export function createGameRoomXoxUs1Runtime(
  deps: XoxUs1InviteRuntimeDeps &
    XoxUs1SyncRuntimeDeps & {
      toInviteApi: XoxUs1InviteApiAdapter;
    }
) {
  const { toInviteApi, ...sharedDeps } = deps;
  const inviteRuntime = createGameRoomXoxUs1InviteRuntime(sharedDeps);
  const syncRuntime = createGameRoomXoxUs1SyncRuntime({
    ...sharedDeps,
    inviteRuntime: inviteRuntime as unknown as Parameters<
      typeof createGameRoomXoxUs1SyncRuntime
    >[0]["inviteRuntime"],
  });
  const asInviteApi = (api: XoxUs1Api) => toInviteApi(api);

  const sendUs1Invite = async (api: XoxUs1Api, state: XoxUs1State, inviteNote: string) =>
    inviteRuntime.sendUs1Invite(
      asInviteApi(api),
      state,
      inviteNote,
      async (_inviteApi: XoxInviteApi, reason: string) => {
        await syncRuntime.syncUs1Mailbox(api, reason);
      }
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
    ) => inviteRuntime.applyInviteAcceptedState(asInviteApi(api), inviteEntry, starter),
    clearUs1SyncLoop: syncRuntime.clearUs1SyncLoop,
    ensureUs1SyncLoop,
    findInviteById: (api: XoxUs1Api, inviteId: string, remoteUserId: string) =>
      inviteRuntime.findInviteById(asInviteApi(api), inviteId, remoteUserId),
    processRoomCommands: syncRuntime.processRoomCommands,
    processRoomEvents: syncRuntime.processRoomEvents,
    readIncomingInviteStarter: inviteRuntime.readIncomingInviteStarter,
    readOutgoingInviteStarter: inviteRuntime.readOutgoingInviteStarter,
    removeInviteFromInbox: (api: XoxUs1Api, inviteId: string, remoteUserId: string | null) =>
      inviteRuntime.removeInviteFromInbox(asInviteApi(api), inviteId, remoteUserId || ""),
    sendUs1Invite,
    sendUs1Move: inviteRuntime.sendUs1Move,
    sendUs1Reset: inviteRuntime.sendUs1Reset,
    syncFromSnapshot: (api: XoxUs1Api, roomInviteInbox: unknown) =>
      inviteRuntime.syncFromSnapshot(asInviteApi(api), roomInviteInbox),
    syncUs1Mailbox,
  };
}
