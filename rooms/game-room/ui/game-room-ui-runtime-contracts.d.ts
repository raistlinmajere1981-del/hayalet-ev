type GameRoomUnknownRecord = Record<string, unknown>;

type GameRoomRoleToken = string | string[] | null;
type GameRoomTextResolver = (path: string[], fallback?: string) => string;
type GameRoomCreateElement = (
  tagName: string,
  className?: string | null,
  textContent?: string
) => HTMLElement;
type GameRoomCreateRegion = (
  tagName: string,
  className: string,
  role: GameRoomRoleToken
) => HTMLElement;
type GameRoomCreateFrame = (
  tagName: string,
  className: string,
  role: GameRoomRoleToken,
  options?: GameRoomFateKnotsFrameArtworkOptions | null
) => HTMLElement;
type GameRoomAppendImage = (
  parent: HTMLElement,
  className: string,
  assetLink: unknown,
  altText: string
) => HTMLElement;
type GameRoomApplyAssetLayers = (
  element: HTMLElement,
  layers: Array<GameRoomFateKnotsAssetLayer | null | undefined>
) => void;
type GameRoomApplyFrameArtwork = (
  element: HTMLElement,
  options: GameRoomFateKnotsFrameArtworkOptions | null | undefined
) => void;
type GameRoomCreateSigil = (className: string, texture: unknown, overlay: unknown) => HTMLElement;
type GameRoomCreateTextChip = (label: string, tone: string) => HTMLElement;
type GameRoomCreateStatBadge = (label: string, value: string, tone: string) => HTMLElement;
type GameRoomCreateActionButton = (
  label: string,
  variant: string,
  disabled: boolean,
  onClick: (event: Event) => void
) => HTMLButtonElement;
type GameRoomCreateCatalogCard = (
  entry: GameRoomFateKnotsCatalogEntry,
  options: GameRoomFateKnotsCatalogCardOptions
) => HTMLButtonElement;
type GameRoomSetSeatId = (element: HTMLElement, seatId: string) => HTMLElement;
type GameRoomGetUiAsset = (assetId: string) => GameRoomFateKnotsAssetLink;
type GameRoomSendRoomCommand = (command: string, payload: GameRoomUnknownRecord) => unknown;
type GameRoomUiGetState = () => GameRoomUiState;
type GameRoomFeatureRecord = { id: string; name: string; description: string };
type GameRoomBootstrapCopy = Record<string, Record<string, string>>;
type GameRoomFateKnotsEvidenceFamily = "creature" | "item" | "location";

interface GameRoomFateKnotsAssetLayer extends GameRoomUnknownRecord {
  asset: unknown;
  size?: string;
  position?: string;
  repeat?: string;
  blend?: string;
}

interface GameRoomFateKnotsFrameArtworkOptions extends GameRoomUnknownRecord {
  overlay?: unknown | null;
  overlaySize?: string;
  overlayPosition?: string;
  overlayBlend?: string;
  frame?: unknown | null;
  frameSize?: string;
  framePosition?: string;
  texture?: unknown | null;
  textureSize?: string;
  texturePosition?: string;
}

interface GameRoomFateKnotsCatalogCardOptions extends GameRoomUnknownRecord {
  disabled?: boolean;
  family?: string;
  metaLines?: string[];
  onClick?: (entryId: string) => void;
  role?: GameRoomRoleToken;
  seatId?: string;
  selected?: boolean;
  template?: unknown;
}

interface GameRoomUiContextState extends GameRoomUnknownRecord {
  activeFeature?: {
    id?: unknown;
  } | null;
  features?: GameRoomFeatureRecord[] | null;
  room: {
    name: string;
  };
  user?: {
    nickname?: unknown;
    avatar?: unknown;
  };
  slots?: Record<string, GameRoomFateKnotsSlotRecord | GameRoomUnknownRecord>;
}

type GameRoomTeamTetrisRotationCell = [number, number];

interface GameRoomTeamTetrisCell {
  x: number;
  y: number;
}

interface GameRoomTeamTetrisPieceBounds {
  width: number;
  height: number;
}

interface GameRoomTeamTetrisBoardDefinition extends GameRoomUnknownRecord {
  width: number;
  height: number;
  seedLabel: string;
}

interface GameRoomTeamTetrisPieceSnapshot extends GameRoomUnknownRecord {
  pieceId: string;
  rotation: number;
  cells: GameRoomTeamTetrisCell[];
  placedBySeatId: string;
  placedByRole: string;
  placedBy: string;
}

interface GameRoomTeamTetrisBoardState extends GameRoomUnknownRecord {
  teamId: string;
  visibility: string;
  rows: string[];
  boardBeforePartnerPieceRows: string[];
  partnerLastPiece: GameRoomTeamTetrisPieceSnapshot | null;
}

interface GameRoomTeamTetrisBoardViewState extends GameRoomTeamTetrisBoardState {
  label: string;
}

interface GameRoomTeamTetrisRequiredSlots extends GameRoomUnknownRecord {
  ai1: boolean;
  ai2: boolean;
  us1: boolean;
}

interface GameRoomTeamTetrisTeamRecord extends GameRoomUnknownRecord {
  teamId: string;
  seatIds: string[];
}

interface GameRoomTeamTetrisTurnState extends GameRoomUnknownRecord {
  turnIndex: number;
  seatId: string;
  teamId: string;
  role: string;
  pieceId: string;
  legalRotations: number[];
  turnToken: string;
}

interface GameRoomTeamTetrisPendingTurn extends GameRoomUnknownRecord {
  turnIndex: number;
  turnToken: string;
  pieceId: string;
  legalRotations: number[];
  actingRole: string;
}

interface GameRoomTeamTetrisSeatViewSeat extends GameRoomUnknownRecord {
  seatId: string;
  teamId: string;
  role: string;
}

interface GameRoomTeamTetrisSeatTeamView extends GameRoomUnknownRecord {
  teamId: string;
  boardRows: string[];
  boardBeforePartnerPieceRows: string[];
  partnerLastPiece: GameRoomTeamTetrisPieceSnapshot | null;
}

interface GameRoomTeamTetrisSeatOpponentView extends GameRoomUnknownRecord {
  teamId: string;
  boardRows: string[];
}

interface GameRoomTeamTetrisSeatView extends GameRoomUnknownRecord {
  schemaVersion: number;
  matchId: string;
  seat: GameRoomTeamTetrisSeatViewSeat;
  hiddenPairs: boolean;
  revealedPairs: boolean;
  result: string;
  winnerTeamId: string | null;
  teams: GameRoomTeamTetrisTeamRecord[] | null;
  ownTeam: GameRoomTeamTetrisSeatTeamView;
  opponentTeam: GameRoomTeamTetrisSeatOpponentView;
  pendingTurn: GameRoomTeamTetrisPendingTurn | null;
}

interface GameRoomTeamTetrisDraftPreview extends GameRoomUnknownRecord {
  success: true;
  x: number;
  y: number;
  rotation: number;
  cells: GameRoomTeamTetrisCell[];
  pathCells: GameRoomTeamTetrisCell[];
  pathComplete: boolean;
  autoDropDistance: number;
  blockedReason?: string;
  stepIndex?: number;
}

interface GameRoomTeamTetrisDraftReplayFailure extends GameRoomUnknownRecord {
  success: false;
  reason: string;
  stepIndex?: number;
  x?: number;
  y?: number;
  rotation?: number;
  cells?: GameRoomTeamTetrisCell[];
  pathCells?: GameRoomTeamTetrisCell[];
  pathComplete?: boolean;
  autoDropDistance?: number;
  blockedReason?: string;
}

type GameRoomTeamTetrisDraftReplayResult =
  | GameRoomTeamTetrisDraftPreview
  | GameRoomTeamTetrisDraftReplayFailure;

type GameRoomTeamTetrisDraftStage = "positioning" | "route";
type GameRoomTeamTetrisRouteMode = "straight" | "bend-left" | "bend-right";
type GameRoomTeamTetrisInteractionMode = "positioning" | "route-row-picker" | "preview";

interface GameRoomTeamTetrisDraftState extends GameRoomUnknownRecord {
  matchId: string;
  turnIndex: number | null;
  turnToken: string;
  pieceId: string;
  rotation: number;
  rowShifts: number[];
  dragTargets: Record<number, number>;
  preview: GameRoomTeamTetrisDraftReplayResult | null;
  errorKey: string;
  dragActive: boolean;
  stage: GameRoomTeamTetrisDraftStage;
  stagedOriginX: number;
  routeMode: GameRoomTeamTetrisRouteMode;
  bendRow: number | null;
  interactionMode: GameRoomTeamTetrisInteractionMode;
}

interface GameRoomTeamTetrisState extends GameRoomUnknownRecord {
  active: boolean;
  result: string;
  hiddenPairs: boolean;
  revealPairsOnFinish: boolean;
  blockedReason: string;
  matchId: string | null;
  canStart: boolean;
  requiredSlots: GameRoomTeamTetrisRequiredSlots;
  board: GameRoomTeamTetrisBoardDefinition;
  boards: GameRoomTeamTetrisBoardState[];
  turnLoop: string[];
  currentTurn: GameRoomTeamTetrisTurnState | null;
  teams: GameRoomTeamTetrisTeamRecord[] | null;
  userView: GameRoomTeamTetrisSeatView | null;
  status: string;
}

interface GameRoomUiState extends GameRoomUnknownRecord {
  locale: string;
  translations: GameRoomUnknownRecord | null;
  context: GameRoomUiContextState;
  game?: unknown;
  teamTetris: GameRoomTeamTetrisState;
  teamTetrisDraft: GameRoomTeamTetrisDraftState;
  fateKnots: GameRoomFateKnotsState;
  presentation: GameRoomUnknownRecord & {
    mode?: string;
    uiScale?: number;
  };
  preferences: GameRoomUnknownRecord & {
    target: string;
    teamTetrisHiddenPairs?: boolean;
    teamTetrisSelectedPartnerSeatId?: string | null;
  };
  lastCommandMessage: string;
}

interface GameRoomUiContextRuntimeLike {
  readPath(source: unknown, path: string[]): string | null;
  normalizePresentationMode(value: unknown): string;
  normalizeUiScale(value: unknown): number;
  resolveLocale(value: unknown): string;
  createContext(): GameRoomUiContextState;
  createSlot(...args: unknown[]): unknown;
  createInviteEntry(...args: unknown[]): unknown;
  normalizeSlot(...args: unknown[]): unknown;
  createElement: GameRoomCreateElement;
  normalizeContext(message: unknown): GameRoomUiContextState;
}

interface GameRoomUiScrollRuntimeLike {
  capture(root: HTMLElement): unknown;
  restore(root: HTMLElement, scrollState: unknown): void;
}

interface GameRoomUiFeatureContractLike {
  ROOM_ID?: unknown;
  FEATURE_ID?: unknown;
  TEAM_TETRIS_FEATURE_ID?: unknown;
  FATE_KNOTS_FEATURE_ID?: unknown;
  getBootstrapCopy?(): GameRoomBootstrapCopy;
  getFeatureRecords?(): GameRoomFeatureRecord[];
}

interface GameRoomXoxUiModule {
  createGameState(): unknown;
  renderBootstrap(root: HTMLElement): void;
  renderXox(root: HTMLElement): void;
  sanitizeGameState?(candidate: unknown): unknown;
  syncPreferencesFromGame?(): void;
}

interface GameRoomTeamTetrisUiModule {
  createTeamTetrisState(): GameRoomTeamTetrisState;
  createTeamTetrisDraft(): GameRoomTeamTetrisDraftState;
  renderTeamTetris(root: HTMLElement): void;
  getTestBridge(): GameRoomTeamTetrisUiTestBridge;
  sanitizeTeamTetrisState(candidate: unknown): GameRoomTeamTetrisState;
  syncTeamTetrisPreferencesFromState(): void;
  syncTeamTetrisDraftFromState(): void;
}

interface GameRoomXoxUiModuleDeps extends GameRoomUnknownRecord {
  getState: GameRoomUiGetState;
  roomId: string;
  featureId: string;
  createSlot(...args: unknown[]): unknown;
  createInviteEntry(...args: unknown[]): unknown;
  normalizeSlot(...args: unknown[]): unknown;
  bootstrapText(key: string): string;
  text: GameRoomTextResolver;
  statusText(key: string): string;
  createElement: GameRoomCreateElement;
  render(): void;
  sendRoomCommand: GameRoomSendRoomCommand;
  isRoomApiAvailable(): boolean;
  getFeatureLabel(featureId: string): string;
}

interface GameRoomTeamTetrisUiModuleDeps extends GameRoomUnknownRecord {
  getState: GameRoomUiGetState;
  featureId: string;
  createSlot(...args: unknown[]): unknown;
  createElement: GameRoomCreateElement;
  text: GameRoomTextResolver;
  render(): void;
  sendRoomCommand: GameRoomSendRoomCommand;
  getFeatureLabel(featureId: string): string;
}

interface GameRoomTeamTetrisUiStateShapeRuntime {
  createTeamTetrisBoard(teamId: string, visibility: string): GameRoomTeamTetrisBoardState;
  createTeamTetrisDraft(): GameRoomTeamTetrisDraftState;
  createTeamTetrisState(): GameRoomTeamTetrisState;
  sanitizeTeamTetrisRows(rows: unknown): string[];
  sanitizeTeamTetrisState(candidate: unknown): GameRoomTeamTetrisState;
}

interface GameRoomTeamTetrisUiStateViewRuntimeDeps {
  getState: GameRoomUiGetState;
  text: GameRoomTextResolver;
  createTeamTetrisBoard(teamId: string, visibility: string): GameRoomTeamTetrisBoardState;
}

interface GameRoomTeamTetrisPlayerDisplay {
  avatarUrl: string | null;
  label: string;
  isAnonymous: boolean;
}

interface GameRoomTeamTetrisUiStateViewRuntime {
  syncTeamTetrisPreferencesFromState(): void;
  getTeamTetrisView(): GameRoomTeamTetrisSeatView | null;
  getTeamTetrisBoardLabel(teamId: string): string;
  getTeamTetrisSeatDisplayLabel(seatId: string): string;
  getTeamTetrisPlayerDisplay(seatId: string): GameRoomTeamTetrisPlayerDisplay;
  getTeamTetrisPendingTurn(): GameRoomTeamTetrisPendingTurn | null;
  getTeamTetrisOwnBoardState(): GameRoomTeamTetrisBoardViewState;
  getTeamTetrisOpponentBoardState(): GameRoomTeamTetrisBoardViewState;
  getTeamTetrisPlacedByLabel(
    pieceSnapshot: GameRoomTeamTetrisPieceSnapshot | null | undefined
  ): string;
  getTeamTetrisPartnerRoleLabel(): string;
  getTeamTetrisTurnLabel(): string;
  getTeamTetrisResultLabel(): string;
  getTeamTetrisDraftStatusText(): string;
  getTeamTetrisStatusText(): string;
}

interface GameRoomTeamTetrisUiDraftRuntimeDeps {
  createTeamTetrisDraft(): GameRoomTeamTetrisDraftState;
  getState: GameRoomUiGetState;
  render(): void;
  sendRoomCommand: GameRoomSendRoomCommand;
  sanitizeTeamTetrisRows(rows: unknown): string[];
  getTeamTetrisOwnBoardState(): GameRoomTeamTetrisBoardViewState;
  getTeamTetrisPendingTurn(): GameRoomTeamTetrisPendingTurn | null;
}

interface GameRoomTeamTetrisUiDraftRuntime {
  getTeamTetrisRotationCells(pieceId: string, rotation: number): GameRoomTeamTetrisRotationCell[];
  getTeamTetrisPieceBounds(pieceId: string, rotation: number): GameRoomTeamTetrisPieceBounds;
  getTeamTetrisSpawnPosition(pieceId: string, rotation: number): GameRoomTeamTetrisCell;
  replayTeamTetrisDraft(
    rows: string[],
    pieceId: string,
    rotation: number,
    rowShifts: number[]
  ): GameRoomTeamTetrisDraftReplayResult;
  compileStageToRowShifts(
    stagedOriginX: number,
    rotation: number,
    pieceId: string,
    routeMode: GameRoomTeamTetrisRouteMode,
    bendRow: number | null
  ): number[];
  buildTeamTetrisRowShiftsFromTargets(
    pieceId: string,
    rotation: number,
    dragTargets: Record<number, number>
  ): number[];
  getTeamTetrisOriginFromCell(pieceId: string, rotation: number, cellX: number): number;
  syncTeamTetrisDraftFromState(): void;
  startTeamTetrisDrag(cellX: number, cellY: number): void;
  updateTeamTetrisDraftTarget(cellX: number, cellY: number): void;
  finishTeamTetrisDrag(): void;
  onTeamTetrisRotationSelect(rotation: number): void;
  onTeamTetrisRotate(): void;
  onTeamTetrisRotateCcw(): void;
  onTeamTetrisClearDraft(): void;
  onTeamTetrisSubmit(): void;
  onTeamTetrisMoveLeft(): void;
  onTeamTetrisMoveRight(): void;
  onTeamTetrisConfirmPosition(): void;
  onTeamTetrisBackToPosition(): void;
  onTeamTetrisRouteModeSelect(mode: GameRoomTeamTetrisRouteMode): void;
  onTeamTetrisBoardColumnSelect(column: number): void;
  onTeamTetrisBendRowSelect(row: number): void;
}

interface GameRoomTeamTetrisUiStateRuntimeDeps {
  getState: GameRoomUiGetState;
  render(): void;
  sendRoomCommand: GameRoomSendRoomCommand;
  text: GameRoomTextResolver;
}

interface GameRoomTeamTetrisUiStateRuntime
  extends
    GameRoomTeamTetrisUiStateShapeRuntime,
    GameRoomTeamTetrisUiStateViewRuntime,
    GameRoomTeamTetrisUiDraftRuntime {
  onTeamTetrisStart(): void;
  onTeamTetrisReset(): void;
}

interface GameRoomTeamTetrisUiModuleCardRuntimeDeps {
  getState: GameRoomUiGetState;
  createSlot(...args: unknown[]): unknown;
  createElement: GameRoomCreateElement;
  text: GameRoomTextResolver;
  getTeamTetrisRotationCells(pieceId: string, rotation: number): GameRoomTeamTetrisRotationCell[];
  getTeamTetrisPieceBounds(pieceId: string, rotation: number): GameRoomTeamTetrisPieceBounds;
  sanitizeTeamTetrisRows(rows: unknown): string[];
  startTeamTetrisDrag(columnIndex: number, rowIndex: number): void;
  updateTeamTetrisDraftTarget(columnIndex: number, rowIndex: number): void;
  finishTeamTetrisDrag(): void;
  onTeamTetrisBoardColumnSelect(column: number): void;
  onTeamTetrisBendRowSelect(row: number): void;
}

interface GameRoomTeamTetrisBoardCardOptions extends GameRoomUnknownRecord {
  interactive?: boolean;
  boardInteractionMode?: GameRoomTeamTetrisInteractionMode;
  overlayCells?: GameRoomTeamTetrisCell[];
  overlayTone?: string;
  overlayPieceId?: string;
  pathCells?: GameRoomTeamTetrisCell[];
  pathTone?: string;
  pathTurnCell?: GameRoomTeamTetrisCell | null;
  pathTurnTone?: string;
  tone?: string;
  meta?: string;
  context?: HTMLElement[];
}

interface GameRoomTeamTetrisUiModuleCardRuntime {
  createTeamTetrisMetric(label: string, value: string): HTMLElement;
  createTeamTetrisPieceCard(
    title: string,
    pieceId: string,
    rotation: number,
    subtitle: string
  ): HTMLElement;
  createTeamTetrisRequirementCard(slotId: string, ready: boolean): HTMLElement;
  createTeamTetrisSnapshotCard(title: string, rows: unknown): HTMLElement;
  renderTeamTetrisBoardCard(
    boardState: GameRoomTeamTetrisBoardViewState,
    options: GameRoomTeamTetrisBoardCardOptions
  ): HTMLElement;
}

interface GameRoomTeamTetrisUiModuleShellRuntimeDeps {
  getState: GameRoomUiGetState;
  featureId?: string;
  createElement: GameRoomCreateElement;
  text: GameRoomTextResolver;
  render(): void;
  getFeatureLabel(featureId: string): string;
  createTeamTetrisMetric(label: string, value: string): HTMLElement;
  createTeamTetrisPieceCard(
    title: string,
    pieceId: string,
    rotation: number,
    subtitle: string
  ): HTMLElement;
  createTeamTetrisRequirementCard(slotId: string, ready: boolean): HTMLElement;
  createTeamTetrisSnapshotCard(title: string, rows: unknown): HTMLElement;
  renderTeamTetrisBoardCard(
    boardState: GameRoomTeamTetrisBoardViewState,
    options: GameRoomTeamTetrisBoardCardOptions
  ): HTMLElement;
  getTeamTetrisView(): GameRoomTeamTetrisSeatView | null;
  getTeamTetrisBoardLabel(teamId: string): string;
  getTeamTetrisSeatDisplayLabel(seatId: string): string;
  getTeamTetrisPendingTurn(): GameRoomTeamTetrisPendingTurn | null;
  getTeamTetrisOwnBoardState(): GameRoomTeamTetrisBoardViewState;
  getTeamTetrisOpponentBoardState(): GameRoomTeamTetrisBoardViewState;
  getTeamTetrisPlacedByLabel(
    pieceSnapshot: GameRoomTeamTetrisPieceSnapshot | null | undefined
  ): string;
  getTeamTetrisPartnerRoleLabel(): string;
  getTeamTetrisTurnLabel(): string;
  getTeamTetrisResultLabel(): string;
  getTeamTetrisDraftStatusText(): string;
  getTeamTetrisStatusText(): string;
  onTeamTetrisRotationSelect(rotation: number): void;
  onTeamTetrisRotate(): void;
  onTeamTetrisRotateCcw(): void;
  onTeamTetrisClearDraft(): void;
  onTeamTetrisSubmit(): void;
  onTeamTetrisMoveLeft(): void;
  onTeamTetrisMoveRight(): void;
  onTeamTetrisConfirmPosition(): void;
  onTeamTetrisBackToPosition(): void;
  onTeamTetrisRouteModeSelect(mode: GameRoomTeamTetrisRouteMode): void;
  onTeamTetrisBendRowSelect(row: number): void;
  onTeamTetrisStart(): void;
  onTeamTetrisReset(): void;
  getTeamTetrisPlayerDisplay(seatId: string): GameRoomTeamTetrisPlayerDisplay;
  compileStageToRowShifts(
    stagedOriginX: number,
    rotation: number,
    pieceId: string,
    routeMode: GameRoomTeamTetrisRouteMode,
    bendRow: number | null
  ): number[];
}

interface GameRoomTeamTetrisUiModuleShellRuntime {
  renderTeamTetris(root: HTMLElement): void;
}

interface GameRoomTeamTetrisUiTestBridge {
  replayDraft(
    rows: string[],
    pieceId: string,
    rotation: number,
    rowShifts: number[]
  ): GameRoomTeamTetrisDraftReplayResult;
  buildRowShiftsFromTargets(
    pieceId: string,
    rotation: number,
    dragTargets: Record<number, number>
  ): number[];
  getOriginFromCell(pieceId: string, rotation: number, cellX: number): number;
  getSpawnPosition(pieceId: string, rotation: number): GameRoomTeamTetrisCell;
}

interface GameRoomFateKnotsAssetInfo extends GameRoomUnknownRecord {
  id: string | null;
  uiSrc: string | null;
  src: string | null;
}

interface GameRoomFateKnotsAssetLink extends GameRoomUnknownRecord {
  assetId: string | null;
  asset: GameRoomFateKnotsAssetInfo;
  expectedAssetId?: string | null;
  uiSrc: string | null;
  src: string | null;
  label: string;
  missingUiAsset?: boolean;
  missingUiAssetKey?: string | null;
  present: boolean;
}

interface GameRoomFateKnotsCatalogEntry extends GameRoomUnknownRecord {
  id: string | null;
  label: string;
  summary: string;
  description: string;
  perk: string;
  stats: GameRoomFateKnotsStatBlock;
  startingDeck: string[];
  asset: GameRoomFateKnotsAssetLink;
}

interface GameRoomFateKnotsStatBlock extends GameRoomUnknownRecord {
  attack?: number;
  defense?: number;
  energy?: number;
  maxEnergy?: number;
  maxHp?: number;
  speed?: number;
}

interface GameRoomFateKnotsSelection extends GameRoomUnknownRecord {
  avatarId: string | null;
  classId: string | null;
  backgroundId: string | null;
  locked: boolean;
  autoAssigned: boolean;
  avatar: GameRoomFateKnotsCatalogEntry;
  class: GameRoomFateKnotsCatalogEntry;
  background: GameRoomFateKnotsCatalogEntry;
}

interface GameRoomFateKnotsParticipant extends GameRoomUnknownRecord {
  seatId: string | null;
  provider: string | null;
  type: string;
  nickname: string;
  ready: boolean;
  connected: boolean;
  active: boolean;
  selection: GameRoomFateKnotsSelection;
  decisionChoiceId: string | null;
  combat: unknown;
}

interface GameRoomFateKnotsCompatibility extends GameRoomUnknownRecord {
  mode: string;
  reason: string;
}

interface GameRoomFateKnotsExcludedSeatRecord extends GameRoomUnknownRecord {
  seatId: string;
  reason: string | null;
}

interface GameRoomFateKnotsWaitingState extends GameRoomUnknownRecord {
  mode: string;
  reason: string;
  pendingSeatIds: string[];
  deadlineAt: string | number | null;
}

interface GameRoomFateKnotsMapMarker extends GameRoomUnknownRecord {
  xPct: number;
  yPct: number;
}

interface GameRoomFateKnotsMapNode extends GameRoomUnknownRecord {
  id: string;
  label: string;
  marker: GameRoomFateKnotsMapMarker | null;
  connections: string[];
}

interface GameRoomFateKnotsCurrentStep extends GameRoomUnknownRecord {
  id: string | null;
  title: string;
  body: string;
  speaker: string;
  location: GameRoomFateKnotsLocation | null;
  sceneAsset: GameRoomFateKnotsAssetLink;
  npcs: GameRoomFateKnotsAssetLink[];
  items: GameRoomFateKnotsAssetLink[];
  creatures: GameRoomFateKnotsAssetLink[];
  choices: GameRoomFateKnotsChoice[];
}

interface GameRoomFateKnotsDecision extends GameRoomUnknownRecord {
  stepId: string | null;
  choiceIds: string[];
  votes: Record<string, string | null | undefined>;
  participantIds: string[];
  resolvedChoiceId: string | null;
  conflict: boolean;
  pendingSeatIds: string[];
  deadlineAt: string | null;
}

interface GameRoomFateKnotsChoice extends GameRoomUnknownRecord {
  id: string;
  label: string;
  summary?: string;
}

interface GameRoomFateKnotsLocation extends GameRoomUnknownRecord {
  label?: string;
}

interface GameRoomFateKnotsCombatTurn extends GameRoomUnknownRecord {
  seatId: string | null;
}

interface GameRoomFateKnotsCombatAction extends GameRoomUnknownRecord {
  id: string;
  label: string;
  type: string;
  cost: number;
  available: boolean;
  description: string;
}

interface GameRoomFateKnotsCombatPartyMember extends GameRoomUnknownRecord {
  seatId?: string | null;
  nickname?: string;
  hp?: number;
  maxHp?: number;
  energy?: number;
  maxEnergy?: number;
  selection: GameRoomFateKnotsSelection;
}

interface GameRoomFateKnotsCombatEnemy extends GameRoomUnknownRecord {
  label: string;
  hp: number;
  maxHp: number;
  asset: GameRoomFateKnotsAssetLink;
}

interface GameRoomFateKnotsCombatState extends GameRoomUnknownRecord {
  encounterId: string | null;
  outcome: string;
  round: number;
  turn: GameRoomFateKnotsCombatTurn | null;
  turnId: string | null;
  party: GameRoomFateKnotsCombatPartyMember[];
  enemy: GameRoomFateKnotsCombatEnemy;
  recentLog: string[];
  availableActions: GameRoomFateKnotsCombatAction[];
}

interface GameRoomFateKnotsResult extends GameRoomUnknownRecord {
  outcome: string;
  title: string;
  summary: string;
  continueHint: string;
}

interface GameRoomFateKnotsMapState extends GameRoomUnknownRecord {
  mapAsset: GameRoomFateKnotsAssetLink;
  nodes: GameRoomFateKnotsMapNode[];
  currentLocationId: string | null;
}

interface GameRoomFateKnotsCatalogs extends GameRoomUnknownRecord {
  avatars: GameRoomFateKnotsCatalogEntry[];
  classes: GameRoomFateKnotsCatalogEntry[];
  backgrounds: GameRoomFateKnotsCatalogEntry[];
}

interface GameRoomFateKnotsUiAssets extends GameRoomUnknownRecord {
  byId: Record<string, GameRoomFateKnotsAssetLink>;
  featureView: GameRoomFateKnotsAssetLink;
}

interface GameRoomFateKnotsProfile extends GameRoomUnknownRecord {
  avatarId: string | null;
  classId: string | null;
  backgroundId: string | null;
  updatedAt?: string | null;
}

interface GameRoomFateKnotsHistoryEntry extends GameRoomUnknownRecord {
  title?: string;
  summary?: string;
  timestamp?: unknown;
}

interface GameRoomFateKnotsTransport extends GameRoomUnknownRecord {
  remoteUserId: string | null;
}

interface GameRoomFateKnotsNarration extends GameRoomUnknownRecord {
  text?: string;
}

interface GameRoomFateKnotsNpcBanter extends GameRoomUnknownRecord {
  seatId?: string | null;
  text?: string;
}

interface GameRoomFateKnotsContentSummary extends GameRoomUnknownRecord {
  assetErrors?: number;
  sourceErrors?: number;
}

interface GameRoomFateKnotsState extends GameRoomUnknownRecord {
  roomId: string;
  featureId: string;
  schemaVersion?: number;
  active: boolean;
  phase: string;
  statusKey: string;
  status: string;
  compatibility: GameRoomFateKnotsCompatibility;
  sessionId: string | null;
  participantMode: string;
  rosterLocked: boolean;
  participants: GameRoomFateKnotsParticipant[];
  excludedSeats: GameRoomFateKnotsExcludedSeatRecord[];
  waiting: GameRoomFateKnotsWaitingState;
  map: GameRoomFateKnotsMapState;
  currentStep: GameRoomFateKnotsCurrentStep | null;
  decision: GameRoomFateKnotsDecision | null;
  combat: GameRoomFateKnotsCombatState | null;
  result: GameRoomFateKnotsResult;
  dmNarration: GameRoomFateKnotsNarration | null;
  npcBanter: GameRoomFateKnotsNpcBanter | null;
  profile: GameRoomFateKnotsProfile;
  history: GameRoomFateKnotsHistoryEntry[];
  scenarioLog: string[];
  transport: GameRoomFateKnotsTransport;
  catalogs: GameRoomFateKnotsCatalogs;
  assetCoverage: Record<string, unknown>;
  contentSummary?: GameRoomFateKnotsContentSummary;
  contentErrors?: string[];
  context?: GameRoomUiContextState;
  uiAssets: GameRoomFateKnotsUiAssets;
}

interface GameRoomFateKnotsSelectionBundle {
  avatar: GameRoomFateKnotsCatalogEntry | null;
  classDef: GameRoomFateKnotsCatalogEntry | null;
  background: GameRoomFateKnotsCatalogEntry | null;
}

interface GameRoomFateKnotsSlotRecord extends GameRoomUnknownRecord {
  label?: string;
  nickname?: string;
  avatar?: string | null;
  providerId?: string | null;
  accountId?: string | null;
  remoteUserId?: string;
  connected?: boolean;
}

interface GameRoomFateKnotsSeatDisplay {
  seatId: string;
  liveParticipant: GameRoomFateKnotsParticipant | null;
  slotRecord: GameRoomFateKnotsSlotRecord | null;
  excludedReason: string | null;
  bundle: GameRoomFateKnotsSelectionBundle | null;
  title: string;
  stateText: string;
  eyebrow: string;
  portraitAsset: GameRoomFateKnotsCatalogEntry | null;
  summaryLines: string[];
  isDummy: boolean;
  isLocal: boolean;
  emblemAsset: GameRoomFateKnotsAssetLink;
}

interface GameRoomFateKnotsUiModule {
  createFateKnotsState(): GameRoomFateKnotsState;
  sanitizeFateKnotsState(candidate: unknown): GameRoomFateKnotsState;
  renderFateKnots(root: HTMLElement): void;
}

interface GameRoomFateKnotsUiStateRuntimeDeps {
  getState: GameRoomUiGetState;
  featureId?: string;
  sendRoomCommand: GameRoomSendRoomCommand;
  text: GameRoomTextResolver;
}

interface GameRoomFateKnotsUiModuleDeps extends GameRoomFateKnotsUiStateRuntimeDeps {
  createElement: GameRoomCreateElement;
  getFeatureLabel?: (featureId: string) => string;
}

interface GameRoomFateKnotsUiStateDefaultsRuntime {
  createDefaultAsset(assetId: string | null): GameRoomFateKnotsAssetLink;
  createDefaultCatalogEntry(): GameRoomFateKnotsCatalogEntry;
  createDefaultParticipant(seatId: string | null): GameRoomFateKnotsParticipant;
  createDefaultResult(): GameRoomFateKnotsResult;
  createDefaultSelection(): GameRoomFateKnotsSelection;
  createDefaultTransport(): GameRoomUnknownRecord;
  createDefaultUiAssets(): GameRoomFateKnotsUiAssets;
  createFateKnotsState(): GameRoomFateKnotsState;
}

interface GameRoomFateKnotsUiStateSanitizeRuntime {
  sanitizeAssetLink(candidate: unknown): GameRoomFateKnotsAssetLink;
  sanitizeCatalogEntry(candidate: unknown): GameRoomFateKnotsCatalogEntry;
  sanitizeSelection(candidate: unknown): GameRoomFateKnotsSelection;
  sanitizeParticipant(candidate: unknown): GameRoomFateKnotsParticipant;
  sanitizeCurrentStep(candidate: unknown): GameRoomFateKnotsCurrentStep;
  sanitizeDecision(candidate: unknown): GameRoomFateKnotsDecision;
  sanitizeCombat(candidate: unknown): GameRoomFateKnotsCombatState;
  sanitizeUiAssets(candidate: unknown): GameRoomFateKnotsUiAssets;
  sanitizeFateKnotsState(candidate: unknown): GameRoomFateKnotsState;
}

interface GameRoomFateKnotsUiStateSupportRuntime {
  findParticipant(
    state: GameRoomFateKnotsState | null,
    seatId: string
  ): GameRoomFateKnotsParticipant | null;
  formatDeck(entry: GameRoomFateKnotsCatalogEntry | null | undefined): string;
  formatDeadline(deadlineAt: unknown): string;
  formatHistoryTimestamp(timestamp: unknown): string;
  formatStats(entry: GameRoomFateKnotsCatalogEntry | null | undefined): string;
  getCurrentState(): GameRoomFateKnotsState | null;
  getCurrentStatus(state: GameRoomFateKnotsState | null): string;
  getPhaseLabel(phaseId: string): string;
  getSelectionBundle(
    state: GameRoomFateKnotsState | null,
    participant: GameRoomFateKnotsParticipant | null
  ): GameRoomFateKnotsSelectionBundle;
  getUserParticipant(state: GameRoomFateKnotsState | null): GameRoomFateKnotsParticipant | null;
  isSelectionComplete(selection: GameRoomFateKnotsSelection | null | undefined): boolean;
  sendChoice(state: GameRoomFateKnotsState, choiceId: string): unknown;
  sendCombatAction(state: GameRoomFateKnotsState, actionId: string): unknown;
  sendReady(state: GameRoomFateKnotsState): unknown;
  sendSelection(fieldName: string, value: unknown): unknown;
  sendSync(state: GameRoomFateKnotsState): unknown;
  t(path: string[], fallback: string): string;
}

interface GameRoomFateKnotsUiStateRuntime
  extends GameRoomFateKnotsUiStateSanitizeRuntime, GameRoomFateKnotsUiStateSupportRuntime {
  createDefaultAsset(assetId: string | null): GameRoomFateKnotsAssetLink;
  createDefaultSelection(): GameRoomFateKnotsSelection;
  createFateKnotsState(): GameRoomFateKnotsState;
}

interface GameRoomFateKnotsUiSurfaceAssetsRuntimeDeps {
  createDefaultAsset(assetId: string | null): GameRoomFateKnotsAssetLink;
  getCurrentState(): GameRoomFateKnotsState | null;
  sanitizeAssetLink(candidate: unknown): GameRoomFateKnotsAssetLink;
}

interface GameRoomFateKnotsUiSurfaceAssetsRuntime {
  ensureUiAssetsPreloaded(): void;
  getUiAsset: GameRoomGetUiAsset;
}

interface GameRoomFateKnotsUiSurfacePrimitivesRuntimeDeps {
  createElement: GameRoomCreateElement;
  getUiAsset: GameRoomGetUiAsset;
  sanitizeAssetLink(candidate: unknown): GameRoomFateKnotsAssetLink;
}

interface GameRoomFateKnotsUiSurfacePrimitivesRuntime {
  appendImage: GameRoomAppendImage;
  applyAssetLayers: GameRoomApplyAssetLayers;
  applyFrameArtwork: GameRoomApplyFrameArtwork;
  assetUrl(assetLink: unknown): string;
  createActionButton: GameRoomCreateActionButton;
  createCatalogCard: GameRoomCreateCatalogCard;
  createFrame: GameRoomCreateFrame;
  createRegion: GameRoomCreateRegion;
  createStatBadge: GameRoomCreateStatBadge;
  createTextChip: GameRoomCreateTextChip;
  setSeatId: GameRoomSetSeatId;
}

interface GameRoomFateKnotsUiSurfaceMapRuntimeDeps {
  applyFrameArtwork: GameRoomApplyFrameArtwork;
  createRegion: GameRoomCreateRegion;
  getUiAsset: GameRoomGetUiAsset;
}

interface GameRoomFateKnotsUiSurfaceMapRuntime {
  createMapPathLayer(
    nodes: GameRoomFateKnotsMapNode[],
    currentLocationId: string | null
  ): HTMLElement;
  createSigil: GameRoomCreateSigil;
}

interface GameRoomFateKnotsUiSurfaceRuntimeDeps {
  createDefaultAsset(assetId: string | null): GameRoomFateKnotsAssetLink;
  createElement: GameRoomCreateElement;
  getCurrentState(): GameRoomFateKnotsState | null;
  sanitizeAssetLink(candidate: unknown): GameRoomFateKnotsAssetLink;
}

interface GameRoomFateKnotsUiSurfaceRuntime
  extends
    GameRoomFateKnotsUiSurfaceAssetsRuntime,
    GameRoomFateKnotsUiSurfacePrimitivesRuntime,
    GameRoomFateKnotsUiSurfaceMapRuntime {}

interface GameRoomFateKnotsUiChromeRuntimeDeps {
  KNOWN_SEAT_IDS: string[];
  appendImage: GameRoomAppendImage;
  applyAssetLayers: GameRoomApplyAssetLayers;
  applyFrameArtwork: GameRoomApplyFrameArtwork;
  createElement: GameRoomCreateElement;
  createFrame: GameRoomCreateFrame;
  createRegion: GameRoomCreateRegion;
  createSigil: GameRoomCreateSigil;
  createTextChip: GameRoomCreateTextChip;
  findParticipant(
    state: GameRoomFateKnotsState | null,
    seatId: string
  ): GameRoomFateKnotsParticipant | null;
  formatDeadline(deadlineAt: unknown): string;
  getCurrentStatus(state: GameRoomFateKnotsState | null): string;
  getPhaseLabel(phaseId: string): string;
  getSelectionBundle(
    state: GameRoomFateKnotsState | null,
    participant: GameRoomFateKnotsParticipant | null
  ): GameRoomFateKnotsSelectionBundle;
  getUiAsset: GameRoomGetUiAsset;
  setSeatId: GameRoomSetSeatId;
  t(path: string[], fallback: string): string;
}

interface GameRoomFateKnotsUiChromeRuntime {
  appendNpcBanter(parent: HTMLElement, state: GameRoomFateKnotsState, seatId: string): void;
  applySurfaceBackdrop(surface: HTMLElement, state: GameRoomFateKnotsState): void;
  buildSeatDisplay(state: GameRoomFateKnotsState, seatId: string): GameRoomFateKnotsSeatDisplay;
  createCoverageLedger(state: GameRoomFateKnotsState): HTMLElement;
  createSeatLabel(state: GameRoomFateKnotsState, seatId: string): string;
  createSeatPlaque(state: GameRoomFateKnotsState, seatId: string, role: string): HTMLElement;
  createSeatRibbon(
    state: GameRoomFateKnotsState,
    role: string,
    activeSeatId: string | null
  ): HTMLElement;
  createSurfaceCorner(role: string, asset: unknown): HTMLElement;
  createTopbar(state: GameRoomFateKnotsState, phaseId: string): HTMLElement;
}

interface GameRoomFateKnotsUiJourneyOverviewRuntimeDeps {
  KNOWN_SEAT_IDS: string[];
  appendImage: GameRoomAppendImage;
  applyFrameArtwork: GameRoomApplyFrameArtwork;
  createActionButton: GameRoomCreateActionButton;
  createDefaultAsset(assetId: string | null): GameRoomFateKnotsAssetLink;
  createElement: GameRoomCreateElement;
  createFrame: GameRoomCreateFrame;
  createMapPathLayer(
    nodes: GameRoomFateKnotsMapNode[],
    currentLocationId: string | null
  ): HTMLElement;
  createRegion: GameRoomCreateRegion;
  createSeatPlaque(state: GameRoomFateKnotsState, seatId: string, role: string): HTMLElement;
  formatHistoryTimestamp(timestamp: unknown): string;
  getUiAsset: GameRoomGetUiAsset;
  sendRoomCommand: GameRoomSendRoomCommand;
  t(path: string[], fallback: string): string;
}

interface GameRoomFateKnotsUiJourneyOverviewRuntime {
  renderOverviewStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
}

interface GameRoomFateKnotsUiJourneyCreationRuntimeDeps {
  KNOWN_SEAT_IDS: string[];
  appendImage: GameRoomAppendImage;
  buildSeatDisplay(state: GameRoomFateKnotsState, seatId: string): GameRoomFateKnotsSeatDisplay;
  createActionButton: GameRoomCreateActionButton;
  createCatalogCard: GameRoomCreateCatalogCard;
  createDefaultAsset(assetId: string | null): GameRoomFateKnotsAssetLink;
  createDefaultSelection(): GameRoomFateKnotsSelection;
  createElement: GameRoomCreateElement;
  createFrame: GameRoomCreateFrame;
  createRegion: GameRoomCreateRegion;
  createSeatLabel(state: GameRoomFateKnotsState, seatId: string): string;
  formatDeck(entry: GameRoomFateKnotsCatalogEntry | null | undefined): string;
  formatStats(entry: GameRoomFateKnotsCatalogEntry | null | undefined): string;
  getSelectionBundle(
    state: GameRoomFateKnotsState | null,
    participant: GameRoomFateKnotsParticipant | null
  ): GameRoomFateKnotsSelectionBundle;
  getUiAsset: GameRoomGetUiAsset;
  getUserParticipant(state: GameRoomFateKnotsState | null): GameRoomFateKnotsParticipant | null;
  isSelectionComplete(selection: GameRoomFateKnotsSelection | null | undefined): boolean;
  sendReady(state: GameRoomFateKnotsState): unknown;
  sendRoomCommand: GameRoomSendRoomCommand;
  sendSelection(fieldName: string, value: unknown): unknown;
  setSeatId: GameRoomSetSeatId;
  t(path: string[], fallback: string): string;
}

interface GameRoomFateKnotsUiJourneyCreationRuntime {
  renderCreationStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
}

interface GameRoomFateKnotsUiJourneyStageRuntimeDeps
  extends
    GameRoomFateKnotsUiJourneyOverviewRuntimeDeps,
    GameRoomFateKnotsUiJourneyCreationRuntimeDeps {}

interface GameRoomFateKnotsUiJourneyStageRuntime {
  renderOverviewStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
  renderCreationStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
}

interface GameRoomFateKnotsUiStageSupportRuntimeDeps {
  appendImage: GameRoomAppendImage;
  createElement: GameRoomCreateElement;
  createFrame: GameRoomCreateFrame;
  getCurrentStatus(state: GameRoomFateKnotsState | null): string;
  getUiAsset: GameRoomGetUiAsset;
  t(path: string[], fallback: string): string;
}

interface GameRoomFateKnotsUiStageSupportRuntime {
  createEvidenceCard(
    assetLink: GameRoomFateKnotsAssetLink,
    label: string,
    family: GameRoomFateKnotsEvidenceFamily
  ): HTMLElement;
  createLogFeed(state: GameRoomFateKnotsState): HTMLElement;
  createNarrationPanel(state: GameRoomFateKnotsState, role: GameRoomRoleToken): HTMLElement;
}

interface GameRoomFateKnotsUiNarrativeStageRuntimeDeps {
  appendImage: GameRoomAppendImage;
  applyFrameArtwork: GameRoomApplyFrameArtwork;
  createActionButton: GameRoomCreateActionButton;
  createElement: GameRoomCreateElement;
  createEvidenceCard(
    assetLink: GameRoomFateKnotsAssetLink,
    label: string,
    family: GameRoomFateKnotsEvidenceFamily
  ): HTMLElement;
  createFrame: GameRoomCreateFrame;
  createLogFeed(state: GameRoomFateKnotsState): HTMLElement;
  createNarrationPanel(state: GameRoomFateKnotsState, role: GameRoomRoleToken): HTMLElement;
  createRegion: GameRoomCreateRegion;
  createSeatRibbon(
    state: GameRoomFateKnotsState,
    role: string,
    activeSeatId: string | null
  ): HTMLElement;
  getUiAsset: GameRoomGetUiAsset;
  sendChoice(state: GameRoomFateKnotsState, choiceId: string): unknown;
  sendRoomCommand: GameRoomSendRoomCommand;
  sendSync(state: GameRoomFateKnotsState): unknown;
  t(path: string[], fallback: string): string;
}

interface GameRoomFateKnotsUiNarrativeStageRuntime {
  renderNarrativeStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
}

interface GameRoomFateKnotsUiCombatStageRuntimeDeps {
  appendImage: GameRoomAppendImage;
  appendNpcBanter(parent: HTMLElement, state: GameRoomFateKnotsState, seatId: string): void;
  applyFrameArtwork: GameRoomApplyFrameArtwork;
  createActionButton: GameRoomCreateActionButton;
  createDefaultSelection(): GameRoomFateKnotsSelection;
  createElement: GameRoomCreateElement;
  createFrame: GameRoomCreateFrame;
  createNarrationPanel(state: GameRoomFateKnotsState, role: GameRoomRoleToken): HTMLElement;
  createRegion: GameRoomCreateRegion;
  createSeatRibbon(
    state: GameRoomFateKnotsState,
    role: string,
    activeSeatId: string | null
  ): HTMLElement;
  createStatBadge: GameRoomCreateStatBadge;
  getUiAsset: GameRoomGetUiAsset;
  sendCombatAction(state: GameRoomFateKnotsState, actionId: string): unknown;
  sendRoomCommand: GameRoomSendRoomCommand;
  sendSync(state: GameRoomFateKnotsState): unknown;
  setSeatId: GameRoomSetSeatId;
  t(path: string[], fallback: string): string;
}

interface GameRoomFateKnotsUiCombatStageRuntime {
  renderCombatStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
}

interface GameRoomFateKnotsUiStageRuntimeDeps
  extends GameRoomFateKnotsUiNarrativeStageRuntimeDeps, GameRoomFateKnotsUiCombatStageRuntimeDeps {
  getCurrentStatus(state: GameRoomFateKnotsState | null): string;
}

interface GameRoomFateKnotsUiStageRuntime {
  renderNarrativeStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
  renderCombatStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
  renderResultStage(parent: HTMLElement, state: GameRoomFateKnotsState): void;
}

interface GameRoomUiBootstrapRuntimeOptions {
  document?: Document;
  navigator?: Navigator;
  render?: () => void;
}

interface GameRoomUiBootstrapRuntime {
  roomId: string;
  featureId: string;
  teamTetrisFeatureId: string;
  fateKnotsFeatureId: string;
  contextRuntime: GameRoomUiContextRuntimeLike;
  scrollRuntime: GameRoomUiScrollRuntimeLike;
  stateRef: {
    current: GameRoomUiState | null;
  };
  getState: GameRoomUiGetState;
  xoxUi: GameRoomXoxUiModule;
  teamTetrisUi: GameRoomTeamTetrisUiModule;
  fateKnotsUi: GameRoomFateKnotsUiModule;
  bootstrapText(key: string): string;
  applyPresentationMode(presentation: unknown): void;
  applyLocale(locale: unknown): void;
  getActiveFeatureId(): string;
  getFeatureLabel(featureId: string): string;
}

interface GameRoomUiStateMessageRuntime {
  handleXoxState(message: unknown): void;
  handleTeamTetrisState(message: unknown): void;
  handleFateKnotsState(message: unknown): void;
  handleCommandResult(message: unknown): void;
}

interface GameRoomUiRuntimeHandle {
  getState(): GameRoomUiState;
  handleHostMessage(message: unknown): void;
  render(): void;
  start(): void;
}

interface GameRoomRoomApi {
  onHostMessage?(handler: (message: unknown) => void): void;
  ready?(payload: GameRoomUnknownRecord): void;
  sendCommand?(command: string, payload: GameRoomUnknownRecord): boolean;
}

interface GameRoomUiBootstrapRuntimeRegistry {
  createGameRoomUiBootstrapRuntime?: (
    options: GameRoomUiBootstrapRuntimeOptions
  ) => GameRoomUiBootstrapRuntime;
}

interface GameRoomUiStateMessageRuntimeRegistry {
  createGameRoomUiStateMessageRuntime?: (options: {
    stateRef: {
      current: GameRoomUiState | null;
    };
    xoxUi: GameRoomXoxUiModule;
    teamTetrisUi: GameRoomTeamTetrisUiModule;
    fateKnotsUi: GameRoomFateKnotsUiModule;
    render: () => void;
  }) => GameRoomUiStateMessageRuntime;
}

interface GameRoomUiRuntimeRegistry {
  createGameRoomUiRuntime?: () => GameRoomUiRuntimeHandle;
}

interface GameRoomUiContextRuntimeRegistry {
  createGameRoomUiContextRuntime?: (options: GameRoomUnknownRecord) => GameRoomUiContextRuntimeLike;
}

interface GameRoomUiScrollRuntimeRegistry {
  createGameRoomUiScrollRuntime?: () => GameRoomUiScrollRuntimeLike;
}

interface GameRoomUiFactoriesRegistry {
  createXoxUiModule?: (deps: GameRoomXoxUiModuleDeps) => GameRoomXoxUiModule;
  createTeamTetrisUiStateShapeRuntime?: () => GameRoomTeamTetrisUiStateShapeRuntime;
  createTeamTetrisUiStateViewRuntime?: (
    deps: GameRoomTeamTetrisUiStateViewRuntimeDeps
  ) => GameRoomTeamTetrisUiStateViewRuntime;
  createTeamTetrisUiDraftRuntime?: (
    deps: GameRoomTeamTetrisUiDraftRuntimeDeps
  ) => GameRoomTeamTetrisUiDraftRuntime;
  createTeamTetrisUiStateRuntime?: (
    deps: GameRoomTeamTetrisUiStateRuntimeDeps
  ) => GameRoomTeamTetrisUiStateRuntime;
  createTeamTetrisUiModuleCardRuntime?: (
    deps: GameRoomTeamTetrisUiModuleCardRuntimeDeps
  ) => GameRoomTeamTetrisUiModuleCardRuntime;
  createTeamTetrisUiModuleShellRuntime?: (
    deps: GameRoomTeamTetrisUiModuleShellRuntimeDeps
  ) => GameRoomTeamTetrisUiModuleShellRuntime;
  createTeamTetrisUiModule?: (deps: GameRoomTeamTetrisUiModuleDeps) => GameRoomTeamTetrisUiModule;
  createFateKnotsUiStateDefaultsRuntime?: () => GameRoomFateKnotsUiStateDefaultsRuntime;
  createFateKnotsUiStateSanitizeRuntime?: () => GameRoomFateKnotsUiStateSanitizeRuntime;
  createFateKnotsUiStateSupportRuntime?: (
    deps: GameRoomFateKnotsUiStateRuntimeDeps
  ) => GameRoomFateKnotsUiStateSupportRuntime;
  createFateKnotsUiStateRuntime?: (
    deps: GameRoomFateKnotsUiStateRuntimeDeps
  ) => GameRoomFateKnotsUiStateRuntime;
  createFateKnotsUiSurfaceAssetsRuntime?: (
    deps: GameRoomFateKnotsUiSurfaceAssetsRuntimeDeps
  ) => GameRoomFateKnotsUiSurfaceAssetsRuntime;
  createFateKnotsUiSurfacePrimitivesRuntime?: (
    deps: GameRoomFateKnotsUiSurfacePrimitivesRuntimeDeps
  ) => GameRoomFateKnotsUiSurfacePrimitivesRuntime;
  createFateKnotsUiSurfaceMapRuntime?: (
    deps: GameRoomFateKnotsUiSurfaceMapRuntimeDeps
  ) => GameRoomFateKnotsUiSurfaceMapRuntime;
  createFateKnotsUiSurfaceRuntime?: (
    deps: GameRoomFateKnotsUiSurfaceRuntimeDeps
  ) => GameRoomFateKnotsUiSurfaceRuntime;
  createFateKnotsUiChromeRuntime?: (
    deps: GameRoomFateKnotsUiChromeRuntimeDeps
  ) => GameRoomFateKnotsUiChromeRuntime;
  createFateKnotsUiStageSupportRuntime?: (
    deps: GameRoomFateKnotsUiStageSupportRuntimeDeps
  ) => GameRoomFateKnotsUiStageSupportRuntime;
  createFateKnotsUiNarrativeStageRuntime?: (
    deps: GameRoomFateKnotsUiNarrativeStageRuntimeDeps
  ) => GameRoomFateKnotsUiNarrativeStageRuntime;
  createFateKnotsUiJourneyOverviewRuntime?: (
    deps: GameRoomFateKnotsUiJourneyOverviewRuntimeDeps
  ) => GameRoomFateKnotsUiJourneyOverviewRuntime;
  createFateKnotsUiJourneyCreationRuntime?: (
    deps: GameRoomFateKnotsUiJourneyCreationRuntimeDeps
  ) => GameRoomFateKnotsUiJourneyCreationRuntime;
  createFateKnotsUiJourneyStageRuntime?: (
    deps: GameRoomFateKnotsUiJourneyStageRuntimeDeps
  ) => GameRoomFateKnotsUiJourneyStageRuntime;
  createFateKnotsUiCombatStageRuntime?: (
    deps: GameRoomFateKnotsUiCombatStageRuntimeDeps
  ) => GameRoomFateKnotsUiCombatStageRuntime;
  createFateKnotsUiStageRuntime?: (
    deps: GameRoomFateKnotsUiStageRuntimeDeps
  ) => GameRoomFateKnotsUiStageRuntime;
  createFateKnotsUiModule?: (deps: GameRoomFateKnotsUiModuleDeps) => GameRoomFateKnotsUiModule;
}

interface GameRoomUiGlobal {
  GameRoomUiFeatureContract?: GameRoomUiFeatureContractLike;
  GameRoomUiFactories?: GameRoomUiFactoriesRegistry;
  GameRoomUiContextRuntime?: GameRoomUiContextRuntimeRegistry;
  GameRoomUiScrollRuntime?: GameRoomUiScrollRuntimeRegistry;
  GameRoomUiRuntime?: GameRoomUiRuntimeRegistry;
  GameRoomUiBootstrapRuntime?: GameRoomUiBootstrapRuntimeRegistry;
  GameRoomUiStateMessageRuntime?: GameRoomUiStateMessageRuntimeRegistry;
  roomAPI?: GameRoomRoomApi;
  __gameRoomTeamTetrisTest__?: GameRoomTeamTetrisUiTestBridge;
}
