export type PatternRoomHostApi = {
  log?: (level: string, message: string) => void;
  notifyRoom?: (type: string, payload?: Record<string, unknown>) => void;
};

export type PatternRoomHostActivation = {
  commands: Record<string, never>;
  dispose: () => void;
  onRoomEvent: (event: unknown) => void;
};

export type PatternRoomHostRuntime = {
  activate: (api: PatternRoomHostApi) => PatternRoomHostActivation;
};

export default function createPatternRoomHostRuntime(): PatternRoomHostRuntime {
  return {
    activate(_api: PatternRoomHostApi): PatternRoomHostActivation {
      return {
        commands: {},
        dispose(): void {
          return undefined;
        },
        onRoomEvent(_event: unknown): void {
          return undefined;
        },
      };
    },
  };
}
