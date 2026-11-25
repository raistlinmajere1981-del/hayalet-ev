interface RoomApiBridge {
  ready?: (payload: Record<string, unknown>) => void;
  onVisibilityChange?: (handler: (visible: boolean) => void) => () => void;
  onHostMessage?: (
    handler: (message: Record<string, unknown>) => void,
    replayContext?: boolean
  ) => void;
  requestStorageCommand?: (
    command: string,
    request: unknown
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  sendCommand?: (command: string, payload?: Record<string, unknown>) => boolean;
  sendEvent?: (type: string, payload?: Record<string, unknown>) => boolean;
  close?: () => boolean;
}

interface Window {
  GameRoomUiFactories?: GameRoomUiFactoriesRegistry;
  GameRoomUiContextRuntime?: GameRoomUiContextRuntimeRegistry;
  GameRoomUiFeatureContract?: GameRoomUiFeatureContractLike;
  GameRoomUiScrollRuntime?: GameRoomUiScrollRuntimeRegistry;
  GameRoomUiRuntime?: GameRoomUiRuntimeRegistry;
  __gameRoomTeamTetrisTest__?: Record<string, unknown>;
  roomAPI?: RoomApiBridge;
  electronAPI?: Record<string, unknown>;
  webkitAudioContext?: typeof AudioContext;
}
