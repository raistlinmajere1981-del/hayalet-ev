interface RoomApiBridge {
  ready?: (payload: Record<string, unknown>) => void;
  onHostMessage?: (handler: (message: Record<string, unknown>) => void) => void;
  sendCommand?: (command: string, payload?: Record<string, unknown>) => boolean;
  sendEvent?: (type: string, payload?: Record<string, unknown>) => boolean;
  close?: () => boolean;
}

interface Window {
  GameRoomUiFactories?: Record<string, any>;
  GameRoomUiContextRuntime?: Record<string, any>;
  GameRoomUiFeatureContract?: Record<string, any>;
  GameRoomUiScrollRuntime?: Record<string, any>;
  GameRoomUiRuntime?: Record<string, any>;
  __gameRoomTeamTetrisTest__?: Record<string, unknown>;
  roomAPI?: RoomApiBridge;
  electronAPI?: Record<string, unknown>;
  webkitAudioContext?: typeof AudioContext;
}
