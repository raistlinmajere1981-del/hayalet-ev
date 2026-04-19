export function bootstrapGameRoomHostState(api, deps) {
  api.log("info", "Game Room host activated.");
  deps.saveContext(api, {});
  deps.saveInviteInbox(api, []);
  deps.clearPendingInvite(api);
  deps.saveXoxState(
    api,
    deps.createInitialXoxState(deps.readLocale(api), deps.defaultTarget, deps.defaultStarter)
  );
  deps.saveTeamTetrisState(api, deps.createInitialTeamTetrisState(deps.readLocale(api)));
  deps.resetFateKnotsState(api, "idle");
  deps.ensureUs1SyncLoop(api);
}
export function createGameRoomHostLifecycle(api, deps) {
  return {
    onRoomReady() {
      deps.pushActiveFeatureState(api);
      if (deps.getActiveFeatureId(deps.loadContext(api)) === deps.fateKnotsFeatureId) {
        void deps.dispatchPendingFateKnotsWork(api);
      }
      void deps.syncUs1Mailbox(api, "room-ready");
    },
    onRoomEvent(payload) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return;
      }
      if (payload.type === "host-context") {
        deps.syncFromContext(api, payload);
        void deps.syncUs1Mailbox(api, "context");
      }
    },
    dispose() {
      deps.clearUs1SyncLoop(api);
      api.log("info", "Game Room host disposed.");
    }
  };
}
