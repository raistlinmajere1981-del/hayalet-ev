export interface GameRoomHostApi {
  log: (level: string, message: string) => void;
  getLocale?: () => unknown;
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => unknown;
}

interface GameRoomBootstrapDependencies {
  saveContext: (api: GameRoomHostApi, payload: unknown) => void;
  saveInviteInbox: (api: GameRoomHostApi, payload: unknown[]) => void;
  clearPendingInvite: (api: GameRoomHostApi) => void;
  saveXoxState: (api: GameRoomHostApi, value: unknown) => void;
  createInitialXoxState: (locale: string, target: string, starter: string) => unknown;
  readLocale: (api: GameRoomHostApi) => string;
  defaultTarget: string;
  defaultStarter: string;
  saveTeamTetrisState: (api: GameRoomHostApi, value: unknown) => void;
  createInitialTeamTetrisState: (locale: string) => unknown;
  resetFateKnotsState: (api: GameRoomHostApi, phase: string) => void;
  ensureUs1SyncLoop: (api: GameRoomHostApi) => void;
}

interface GameRoomLifecycleDependencies {
  pushActiveFeatureState: (api: GameRoomHostApi) => void;
  getActiveFeatureId: (context: unknown) => string;
  loadContext: (api: GameRoomHostApi) => unknown;
  fateKnotsFeatureId: string;
  dispatchPendingFateKnotsWork: (api: GameRoomHostApi) => Promise<unknown>;
  syncUs1Mailbox: (api: GameRoomHostApi, reason: string) => Promise<unknown>;
  syncFromContext: (api: GameRoomHostApi, payload: unknown) => void;
  clearUs1SyncLoop: (api: GameRoomHostApi) => void;
}

export function bootstrapGameRoomHostState(
  api: GameRoomHostApi,
  deps: GameRoomBootstrapDependencies
): void {
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

export function createGameRoomHostLifecycle(
  api: GameRoomHostApi,
  deps: GameRoomLifecycleDependencies
): {
  onRoomReady: () => void;
  onRoomEvent: (payload: unknown) => void;
  dispose: () => void;
} {
  return {
    onRoomReady() {
      deps.pushActiveFeatureState(api);
      if (deps.getActiveFeatureId(deps.loadContext(api)) === deps.fateKnotsFeatureId) {
        void deps.dispatchPendingFateKnotsWork(api);
      }
      void deps.syncUs1Mailbox(api, "room-ready");
    },
    onRoomEvent(payload: unknown) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return;
      }

      if ((payload as { type?: unknown }).type === "host-context") {
        deps.syncFromContext(api, payload);
        void deps.syncUs1Mailbox(api, "context");
      }
    },
    dispose() {
      deps.clearUs1SyncLoop(api);
      api.log("info", "Game Room host disposed.");
    },
  };
}
