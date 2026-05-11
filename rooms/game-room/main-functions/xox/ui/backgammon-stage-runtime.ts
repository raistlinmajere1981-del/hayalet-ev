(function (
  global: typeof globalThis & {
    GameRoomUiFactories?: GameRoomUiFactoriesRegistry;
    Konva?: unknown;
  }
) {
  type BackgammonSeat = "user" | "ai";
  type BackgammonOwner = BackgammonSeat | "";
  type BackgammonPoint = {
    point: number;
    owner: BackgammonOwner;
    count: number;
  };
  type BackgammonLocation =
    | { type: "bar"; seat: BackgammonSeat }
    | { type: "off" }
    | { type: "point"; point: number };
  type BackgammonSubMove = {
    from: BackgammonLocation;
    to: BackgammonLocation;
    die: number;
    hit: boolean;
  };
  type BackgammonLegalMove = {
    id: string;
    label: string;
    moves: BackgammonSubMove[];
    diceUsed: number[];
    pass?: boolean;
  };
  type BackgammonGameState = {
    active: boolean;
    awaitingMoveFrom: "user" | "ai" | null;
    blockedReason: string;
    board: BackgammonPoint[];
    bar: Record<BackgammonSeat, number>;
    off: Record<BackgammonSeat, number>;
    dice: number[];
    legalMoves: BackgammonLegalMove[];
    turnIndex: number;
    turnToken: string;
    boardHash?: string;
  };
  type StagePoint = { x: number; y: number };
  type RectLike = { x: number; y: number; width: number; height: number };
  type KonvaEvent = { target?: KonvaNode; evt?: Event };
  type KonvaNode = {
    add?: (...nodes: KonvaNode[]) => void;
    batchDraw?: () => void;
    destroy?: () => void;
    destroyChildren?: () => void;
    getPointerPosition?: () => StagePoint | null;
    moveToTop?: () => void;
    off?: (eventName?: string) => void;
    on?: (eventName: string, handler: (event: KonvaEvent) => void) => void;
    position?: {
      (): StagePoint;
      (value: StagePoint): void;
    };
    to?: (config: Record<string, unknown>) => void;
    x?: {
      (): number;
      (value: number): void;
    };
    y?: {
      (): number;
      (value: number): void;
    };
  };
  type KonvaStage = KonvaNode & {
    add: (...nodes: KonvaNode[]) => void;
    batchDraw: () => void;
    destroy: () => void;
    destroyChildren: () => void;
    getPointerPosition: () => StagePoint | null;
    on: (eventName: string, handler: (event: KonvaEvent) => void) => void;
  };
  type KonvaLayer = KonvaNode & {
    add: (...nodes: KonvaNode[]) => void;
    destroyChildren: () => void;
  };
  type KonvaGroup = KonvaNode & {
    add: (...nodes: KonvaNode[]) => void;
    moveToTop: () => void;
    on: (eventName: string, handler: (event: KonvaEvent) => void) => void;
    position: {
      (): StagePoint;
      (value: StagePoint): void;
    };
    to: (config: Record<string, unknown>) => void;
  };
  type KonvaConstructor<T extends KonvaNode> = new (config?: Record<string, unknown>) => T;
  type KonvaNamespace = {
    Stage: new (config: { container: HTMLDivElement; height: number; width: number }) => KonvaStage;
    Layer: KonvaConstructor<KonvaLayer>;
    Group: KonvaConstructor<KonvaGroup>;
    Rect: KonvaConstructor<KonvaNode>;
    Line: KonvaConstructor<KonvaNode>;
    Circle: KonvaConstructor<KonvaNode>;
    Text: KonvaConstructor<KonvaNode>;
  };
  type BackgammonStageRuntimeDeps = {
    getState: () => { game: BackgammonGameState };
    createElement: (tagName: string, className?: string, textContent?: string) => HTMLElement;
    text: (path: string[]) => string;
    stateRuntime: {
      onLegalMove: (moveId: string) => void;
    };
  };
  type BackgammonStageRenderOptions = {
    canUserMove: boolean;
    game: BackgammonGameState;
  };
  type BackgammonStageRuntime = {
    destroy: () => void;
    renderBackgammonStage: (host: HTMLElement, options: BackgammonStageRenderOptions) => void;
  };
  type BackgammonStageRuntimeRegistry = GameRoomUiFactoriesRegistry & {
    createXoxBackgammonStageRuntime?: (deps: BackgammonStageRuntimeDeps) => BackgammonStageRuntime;
  };
  type BoardSnapshot = {
    board: BackgammonPoint[];
    bar: Record<BackgammonSeat, number>;
    off: Record<BackgammonSeat, number>;
  };
  type BoardMetrics = {
    board: RectLike;
    bar: RectLike;
    offAi: RectLike;
    offUser: RectLike;
    dice: RectLike;
    pointRects: Record<number, RectLike>;
  };

  const registry = (global.GameRoomUiFactories ||
    (global.GameRoomUiFactories =
      {} as GameRoomUiFactoriesRegistry)) as BackgammonStageRuntimeRegistry;

  const WIDTH = 980;
  const HEIGHT = 600;
  const CHECKER_RADIUS = 18;
  const USER_COLOR = "#f5dfaa";
  const USER_EDGE = "#9d6f2f";
  const AI_COLOR = "#14384a";
  const AI_EDGE = "#78d3c4";

  function isKonvaNamespace(value: unknown): value is KonvaNamespace {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const source = value as Record<string, unknown>;
    return (
      typeof source["Stage"] === "function" &&
      typeof source["Layer"] === "function" &&
      typeof source["Group"] === "function" &&
      typeof source["Rect"] === "function" &&
      typeof source["Line"] === "function" &&
      typeof source["Circle"] === "function" &&
      typeof source["Text"] === "function"
    );
  }

  function readText(deps: BackgammonStageRuntimeDeps, path: string[], fallback: string): string {
    const value = deps.text(path);
    return value === path.join(".") ? fallback : value;
  }

  function clonePoint(point: BackgammonPoint): BackgammonPoint {
    return { point: point.point, owner: point.owner, count: Math.max(0, Math.trunc(point.count)) };
  }

  function cloneSnapshot(game: BackgammonGameState): BoardSnapshot {
    return {
      board: game.board.map(clonePoint),
      bar: { user: game.bar.user || 0, ai: game.bar.ai || 0 },
      off: { user: game.off.user || 0, ai: game.off.ai || 0 },
    };
  }

  function normalizeBoard(board: BackgammonPoint[]): BackgammonPoint[] {
    const points: BackgammonPoint[] = [];
    for (let point = 1; point <= 24; point += 1) {
      const candidate = board.find((entry) => entry.point === point);
      points.push(candidate ? clonePoint(candidate) : { point, owner: "", count: 0 });
    }
    return points;
  }

  function getPoint(snapshot: BoardSnapshot, point: number): BackgammonPoint {
    return snapshot.board[point - 1] ?? { point, owner: "", count: 0 };
  }

  function sameLocation(left: BackgammonLocation, right: BackgammonLocation): boolean {
    if (left.type !== right.type) {
      return false;
    }
    if (left.type === "point" && right.type === "point") {
      return left.point === right.point;
    }
    if (left.type === "bar" && right.type === "bar") {
      return left.seat === right.seat;
    }
    return true;
  }

  function moveMatchesPrefix(move: BackgammonLegalMove, prefix: BackgammonSubMove[]): boolean {
    if (prefix.length > move.moves.length) {
      return false;
    }
    return prefix.every((subMove, index) => {
      const candidate = move.moves[index];
      return (
        candidate !== undefined &&
        sameLocation(subMove.from, candidate.from) &&
        sameLocation(subMove.to, candidate.to) &&
        subMove.die === candidate.die
      );
    });
  }

  function getNextSubMoves(
    legalMoves: BackgammonLegalMove[],
    prefix: BackgammonSubMove[]
  ): BackgammonSubMove[] {
    const seen = new Set<string>();
    const subMoves: BackgammonSubMove[] = [];
    legalMoves.forEach((move) => {
      if (move.pass === true || !moveMatchesPrefix(move, prefix)) {
        return;
      }
      const next = move.moves[prefix.length];
      if (next === undefined) {
        return;
      }
      const key = `${locationKey(next.from)}>${locationKey(next.to)}:${next.die}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      subMoves.push(next);
    });
    return subMoves;
  }

  function findCompletedMove(
    legalMoves: BackgammonLegalMove[],
    prefix: BackgammonSubMove[]
  ): BackgammonLegalMove | null {
    return (
      legalMoves.find(
        (move) =>
          move.pass !== true &&
          move.moves.length === prefix.length &&
          moveMatchesPrefix(move, prefix)
      ) ?? null
    );
  }

  function locationKey(location: BackgammonLocation): string {
    if (location.type === "point") {
      return `point:${location.point}`;
    }
    if (location.type === "bar") {
      return `bar:${location.seat}`;
    }
    return "off";
  }

  function decrementLocation(snapshot: BoardSnapshot, location: BackgammonLocation): void {
    if (location.type === "bar") {
      snapshot.bar[location.seat] = Math.max(0, snapshot.bar[location.seat] - 1);
      return;
    }
    if (location.type !== "point") {
      return;
    }
    const point = getPoint(snapshot, location.point);
    point.count = Math.max(0, point.count - 1);
    if (point.count === 0) {
      point.owner = "";
    }
  }

  function incrementDestination(snapshot: BoardSnapshot, destination: BackgammonLocation): void {
    if (destination.type === "off") {
      snapshot.off.user += 1;
      return;
    }
    if (destination.type !== "point") {
      return;
    }
    const point = getPoint(snapshot, destination.point);
    if (point.owner === "ai" && point.count === 1) {
      snapshot.bar.ai += 1;
      point.owner = "user";
      point.count = 1;
      return;
    }
    if (point.owner === "user") {
      point.count += 1;
      return;
    }
    point.owner = "user";
    point.count = 1;
  }

  function applySubMove(snapshot: BoardSnapshot, subMove: BackgammonSubMove): void {
    decrementLocation(snapshot, subMove.from);
    incrementDestination(snapshot, subMove.to);
  }

  function applyPreview(
    game: BackgammonGameState,
    stagedMoves: BackgammonSubMove[]
  ): BoardSnapshot {
    const snapshot = cloneSnapshot(game);
    snapshot.board = normalizeBoard(snapshot.board);
    stagedMoves.forEach((subMove) => applySubMove(snapshot, subMove));
    return snapshot;
  }

  function buildMetrics(): BoardMetrics {
    const board: RectLike = { x: 34, y: 42, width: 748, height: 496 };
    const innerPad = 18;
    const barWidth = 54;
    const pointWidth = (board.width - innerPad * 2 - barWidth) / 12;
    const halfHeight = (board.height - innerPad * 2) / 2;
    const innerX = board.x + innerPad;
    const topY = board.y + innerPad;
    const bottomY = topY + halfHeight;
    const pointRects: Record<number, RectLike> = {};

    for (let point = 1; point <= 24; point += 1) {
      const top = point >= 13;
      const visualIndex = top ? 24 - point : point - 1;
      const x = innerX + visualIndex * pointWidth + (visualIndex >= 6 ? barWidth : 0);
      pointRects[point] = {
        x,
        y: top ? topY : bottomY,
        width: pointWidth,
        height: halfHeight,
      };
    }

    return {
      board,
      bar: {
        x: innerX + pointWidth * 6,
        y: topY,
        width: barWidth,
        height: halfHeight * 2,
      },
      offAi: { x: 810, y: 76, width: 124, height: 182 },
      offUser: { x: 810, y: 322, width: 124, height: 182 },
      dice: { x: 808, y: 262, width: 130, height: 54 },
      pointRects,
    };
  }

  function rectContains(rect: RectLike, point: StagePoint): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  function getPointRect(metrics: BoardMetrics, point: number): RectLike {
    return metrics.pointRects[point] ?? metrics.board;
  }

  function findDropTarget(metrics: BoardMetrics, point: StagePoint): BackgammonLocation | null {
    if (rectContains(metrics.offUser, point)) {
      return { type: "off" };
    }
    for (let index = 1; index <= 24; index += 1) {
      if (rectContains(getPointRect(metrics, index), point)) {
        return { type: "point", point: index };
      }
    }
    return null;
  }

  function getCheckerPosition(
    rect: RectLike,
    row: "top" | "bottom",
    stackIndex: number,
    total: number
  ): StagePoint {
    const visible = Math.min(total, 5);
    const overlap = Math.min(
      31,
      Math.max(22, (rect.height - CHECKER_RADIUS * 2) / Math.max(1, visible - 1))
    );
    const x = rect.x + rect.width / 2;
    if (row === "top") {
      return { x, y: rect.y + CHECKER_RADIUS + stackIndex * overlap };
    }
    return { x, y: rect.y + rect.height - CHECKER_RADIUS - stackIndex * overlap };
  }

  function sourceIsAvailable(source: BackgammonLocation, candidates: BackgammonSubMove[]): boolean {
    return candidates.some((candidate) => sameLocation(candidate.from, source));
  }

  function drawRoundedPanel(
    Konva: KonvaNamespace,
    layer: KonvaLayer,
    rect: RectLike,
    options: { fill: string; stroke?: string; shadow?: boolean }
  ): void {
    layer.add(
      new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        cornerRadius: 18,
        fill: options.fill,
        stroke: options.stroke ?? "rgba(255,255,255,0.12)",
        strokeWidth: 1,
        shadowColor: options.shadow === true ? "rgba(0,0,0,0.42)" : "transparent",
        shadowBlur: options.shadow === true ? 24 : 0,
        shadowOffsetY: options.shadow === true ? 10 : 0,
      })
    );
  }

  function drawBoardBase(Konva: KonvaNamespace, layer: KonvaLayer, metrics: BoardMetrics): void {
    drawRoundedPanel(Konva, layer, metrics.board, {
      fill: "#5d3924",
      stroke: "rgba(246,219,168,0.36)",
      shadow: true,
    });
    layer.add(
      new Konva.Rect({
        x: metrics.board.x + 10,
        y: metrics.board.y + 10,
        width: metrics.board.width - 20,
        height: metrics.board.height - 20,
        cornerRadius: 12,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: metrics.board.width, y: metrics.board.height },
        fillLinearGradientColorStops: [0, "#2c403a", 0.52, "#1e2f31", 1, "#39513f"],
        stroke: "rgba(255,255,255,0.08)",
        strokeWidth: 1,
      })
    );
    layer.add(
      new Konva.Rect({
        x: metrics.bar.x,
        y: metrics.bar.y,
        width: metrics.bar.width,
        height: metrics.bar.height,
        fill: "rgba(52, 31, 21, 0.72)",
        stroke: "rgba(246,219,168,0.22)",
        strokeWidth: 1,
      })
    );
    drawRoundedPanel(Konva, layer, metrics.offAi, {
      fill: "rgba(8,20,28,0.62)",
      stroke: "rgba(120,211,196,0.22)",
    });
    drawRoundedPanel(Konva, layer, metrics.offUser, {
      fill: "rgba(61,38,22,0.58)",
      stroke: "rgba(245,223,170,0.24)",
    });
  }

  function drawPoints(Konva: KonvaNamespace, layer: KonvaLayer, metrics: BoardMetrics): void {
    for (let point = 1; point <= 24; point += 1) {
      const rect = getPointRect(metrics, point);
      const top = point >= 13;
      const fill = point % 2 === 0 ? "#d8b066" : "#2f9587";
      const points = top
        ? [
            rect.x + 5,
            rect.y + 4,
            rect.x + rect.width - 5,
            rect.y + 4,
            rect.x + rect.width / 2,
            rect.y + rect.height - 16,
          ]
        : [
            rect.x + 5,
            rect.y + rect.height - 4,
            rect.x + rect.width - 5,
            rect.y + rect.height - 4,
            rect.x + rect.width / 2,
            rect.y + 16,
          ];
      layer.add(
        new Konva.Line({
          points,
          closed: true,
          fill,
          opacity: 0.72,
          shadowColor: "rgba(0,0,0,0.28)",
          shadowBlur: 8,
          shadowOffsetY: top ? 2 : -2,
        })
      );
      layer.add(
        new Konva.Text({
          x: rect.x,
          y: top ? rect.y + rect.height - 20 : rect.y + 7,
          width: rect.width,
          align: "center",
          text: String(point),
          fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
          fontSize: 10,
          fill: "rgba(237,243,246,0.52)",
          listening: false,
        })
      );
    }
  }

  function drawTargetHighlight(
    Konva: KonvaNamespace,
    layer: KonvaLayer,
    metrics: BoardMetrics,
    location: BackgammonLocation,
    tone: "source" | "target"
  ): void {
    const rect =
      location.type === "point"
        ? getPointRect(metrics, location.point)
        : location.type === "off"
          ? metrics.offUser
          : metrics.bar;
    const color = tone === "source" ? "rgba(245,223,170,0.42)" : "rgba(121,211,196,0.54)";
    layer.add(
      new Konva.Rect({
        x: rect.x + 4,
        y: rect.y + 4,
        width: rect.width - 8,
        height: rect.height - 8,
        cornerRadius: 10,
        stroke: color,
        strokeWidth: 2,
        dash: tone === "target" ? [8, 5] : [],
        fill: tone === "target" ? "rgba(121,211,196,0.08)" : "rgba(245,223,170,0.06)",
        listening: false,
      })
    );
  }

  function drawCheckers(
    Konva: KonvaNamespace,
    layer: KonvaLayer,
    snapshot: BoardSnapshot,
    metrics: BoardMetrics,
    candidates: BackgammonSubMove[],
    attachDragHandlers: (group: KonvaGroup, source: BackgammonLocation) => void
  ): void {
    snapshot.board.forEach((point) => {
      if (point.owner !== "user" && point.owner !== "ai") {
        return;
      }
      const rect = getPointRect(metrics, point.point);
      const row = point.point >= 13 ? "top" : "bottom";
      const visible = Math.min(point.count, 5);
      for (let index = 0; index < visible; index += 1) {
        const source: BackgammonLocation = { type: "point", point: point.point };
        const draggable =
          point.owner === "user" && index === visible - 1 && sourceIsAvailable(source, candidates);
        const position = getCheckerPosition(rect, row, index, point.count);
        const checker = createChecker(
          Konva,
          point.owner,
          position,
          draggable,
          index === visible - 1 ? point.count : 0
        );
        if (draggable) {
          attachDragHandlers(checker, source);
        }
        layer.add(checker);
      }
    });

    drawBarCheckers(Konva, layer, snapshot, metrics, candidates, attachDragHandlers);
    drawOffCheckers(Konva, layer, snapshot, metrics);
  }

  function createChecker(
    Konva: KonvaNamespace,
    owner: BackgammonSeat,
    position: StagePoint,
    draggable: boolean,
    total: number
  ): KonvaGroup {
    const group = new Konva.Group({
      x: position.x,
      y: position.y,
      draggable,
      cursor: draggable ? "grab" : "default",
    });
    const fill = owner === "user" ? USER_COLOR : AI_COLOR;
    const stroke = owner === "user" ? USER_EDGE : AI_EDGE;
    group.add(
      new Konva.Circle({
        x: 0,
        y: 0,
        radius: CHECKER_RADIUS,
        fill,
        stroke,
        strokeWidth: 2,
        shadowColor: "rgba(0,0,0,0.38)",
        shadowBlur: 8,
        shadowOffsetY: 4,
      })
    );
    group.add(
      new Konva.Circle({
        x: 0,
        y: -3,
        radius: CHECKER_RADIUS - 6,
        stroke: owner === "user" ? "rgba(255,255,255,0.48)" : "rgba(120,211,196,0.28)",
        strokeWidth: 1,
        listening: false,
      })
    );
    if (total > 5) {
      group.add(
        new Konva.Text({
          x: -CHECKER_RADIUS,
          y: -7,
          width: CHECKER_RADIUS * 2,
          align: "center",
          text: String(total),
          fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
          fontSize: 13,
          fontStyle: "bold",
          fill: owner === "user" ? "#1a1207" : "#f5dfaa",
          listening: false,
        })
      );
    }
    return group;
  }

  function drawBarCheckers(
    Konva: KonvaNamespace,
    layer: KonvaLayer,
    snapshot: BoardSnapshot,
    metrics: BoardMetrics,
    candidates: BackgammonSubMove[],
    attachDragHandlers: (group: KonvaGroup, source: BackgammonLocation) => void
  ): void {
    const barSource: BackgammonLocation = { type: "bar", seat: "user" };
    const userVisible = Math.min(snapshot.bar.user, 4);
    for (let index = 0; index < userVisible; index += 1) {
      const y = metrics.bar.y + metrics.bar.height - CHECKER_RADIUS - 12 - index * 30;
      const draggable = index === userVisible - 1 && sourceIsAvailable(barSource, candidates);
      const checker = createChecker(
        Konva,
        "user",
        { x: metrics.bar.x + metrics.bar.width / 2, y },
        draggable,
        index === userVisible - 1 ? snapshot.bar.user : 0
      );
      if (draggable) {
        attachDragHandlers(checker, barSource);
      }
      layer.add(checker);
    }
    const aiVisible = Math.min(snapshot.bar.ai, 4);
    for (let index = 0; index < aiVisible; index += 1) {
      layer.add(
        createChecker(
          Konva,
          "ai",
          {
            x: metrics.bar.x + metrics.bar.width / 2,
            y: metrics.bar.y + CHECKER_RADIUS + 12 + index * 30,
          },
          false,
          index === aiVisible - 1 ? snapshot.bar.ai : 0
        )
      );
    }
  }

  function drawOffCheckers(
    Konva: KonvaNamespace,
    layer: KonvaLayer,
    snapshot: BoardSnapshot,
    metrics: BoardMetrics
  ): void {
    drawOffStack(Konva, layer, metrics.offAi, "ai", snapshot.off.ai);
    drawOffStack(Konva, layer, metrics.offUser, "user", snapshot.off.user);
  }

  function drawOffStack(
    Konva: KonvaNamespace,
    layer: KonvaLayer,
    rect: RectLike,
    owner: BackgammonSeat,
    count: number
  ): void {
    const visible = Math.min(count, 5);
    for (let index = 0; index < visible; index += 1) {
      const y = rect.y + rect.height - 22 - index * 24;
      layer.add(
        createChecker(
          Konva,
          owner,
          { x: rect.x + rect.width / 2, y },
          false,
          index === visible - 1 ? count : 0
        )
      );
    }
  }

  function drawDice(
    Konva: KonvaNamespace,
    layer: KonvaLayer,
    metrics: BoardMetrics,
    dice: number[],
    animate: boolean
  ): void {
    const values = dice.length > 0 ? dice.slice(0, 2) : [];
    const group = new Konva.Group({ x: metrics.dice.x, y: metrics.dice.y });
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: metrics.dice.width,
        height: metrics.dice.height,
        cornerRadius: 14,
        fill: "rgba(5,14,21,0.58)",
        stroke: "rgba(246,219,168,0.18)",
        strokeWidth: 1,
      })
    );
    if (values.length === 0) {
      group.add(
        new Konva.Text({
          x: 0,
          y: 18,
          width: metrics.dice.width,
          text: "-",
          align: "center",
          fontSize: 18,
          fill: "rgba(237,243,246,0.55)",
        })
      );
      layer.add(group);
      return;
    }
    values.forEach((value, index) => {
      const die = createDie(Konva, value, 14 + index * 48, 8);
      if (animate) {
        die.to({ rotation: 360, duration: 0.42, easing: "EaseOut" });
      }
      group.add(die);
    });
    if (dice.length > 2) {
      group.add(
        new Konva.Text({
          x: 102,
          y: 19,
          width: 24,
          text: "x4",
          align: "center",
          fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
          fontSize: 12,
          fontStyle: "bold",
          fill: "#f5dfaa",
        })
      );
    }
    layer.add(group);
  }

  function createDie(Konva: KonvaNamespace, value: number, x: number, y: number): KonvaGroup {
    const group = new Konva.Group({ x: x + 19, y: y + 19, offsetX: 19, offsetY: 19 });
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: 38,
        height: 38,
        cornerRadius: 8,
        fill: "#f7ead0",
        stroke: "#9d6f2f",
        strokeWidth: 1.5,
        shadowColor: "rgba(0,0,0,0.34)",
        shadowBlur: 7,
        shadowOffsetY: 3,
      })
    );
    const pipMap: Record<number, StagePoint[]> = {
      1: [{ x: 19, y: 19 }],
      2: [
        { x: 12, y: 12 },
        { x: 26, y: 26 },
      ],
      3: [
        { x: 11, y: 11 },
        { x: 19, y: 19 },
        { x: 27, y: 27 },
      ],
      4: [
        { x: 12, y: 12 },
        { x: 26, y: 12 },
        { x: 12, y: 26 },
        { x: 26, y: 26 },
      ],
      5: [
        { x: 12, y: 12 },
        { x: 26, y: 12 },
        { x: 19, y: 19 },
        { x: 12, y: 26 },
        { x: 26, y: 26 },
      ],
      6: [
        { x: 12, y: 11 },
        { x: 26, y: 11 },
        { x: 12, y: 19 },
        { x: 26, y: 19 },
        { x: 12, y: 27 },
        { x: 26, y: 27 },
      ],
    };
    const pips = pipMap[value] ?? pipMap[1] ?? [];
    pips.forEach((pip) => {
      group.add(new Konva.Circle({ x: pip.x, y: pip.y, radius: 3.1, fill: "#2b1b10" }));
    });
    return group;
  }

  registry.createXoxBackgammonStageRuntime = function createXoxBackgammonStageRuntime(
    deps: BackgammonStageRuntimeDeps
  ): BackgammonStageRuntime {
    let stage: KonvaStage | null = null;
    let mountedHost: HTMLElement | null = null;
    let lastTurnSignature = "";
    let stagedMoves: BackgammonSubMove[] = [];
    let activeGame: BackgammonGameState | null = null;
    let activeCanUserMove = false;

    function destroy(): void {
      if (stage !== null) {
        stage.destroy();
        stage = null;
      }
      mountedHost = null;
    }

    function turnSignature(game: BackgammonGameState): string {
      return [
        game.turnIndex,
        game.turnToken,
        game.boardHash ?? "",
        game.dice.join("-"),
        game.awaitingMoveFrom ?? "none",
      ].join("|");
    }

    function resetStagedMovesIfNeeded(game: BackgammonGameState): boolean {
      const signature = turnSignature(game);
      const changed = signature !== lastTurnSignature;
      if (changed) {
        stagedMoves = [];
        lastTurnSignature = signature;
      }
      return changed;
    }

    function attachDragHandlers(
      Konva: KonvaNamespace,
      group: KonvaGroup,
      source: BackgammonLocation,
      drawScene: (animateDice: boolean) => void,
      metrics: BoardMetrics
    ): void {
      group.on("dragstart", () => {
        group.moveToTop();
      });
      group.on("dragend", () => {
        const pointer = stage?.getPointerPosition() ?? group.position();
        const target = findDropTarget(metrics, pointer);
        const game = activeGame;
        if (target === null || game === null) {
          drawScene(false);
          return;
        }
        const next = getNextSubMoves(game.legalMoves, stagedMoves).find(
          (candidate) => sameLocation(candidate.from, source) && sameLocation(candidate.to, target)
        );
        if (next === undefined) {
          drawScene(false);
          return;
        }
        stagedMoves.push(next);
        const completedMove = findCompletedMove(game.legalMoves, stagedMoves);
        if (completedMove !== null) {
          const completedMoveId = completedMove.id;
          stagedMoves = [];
          deps.stateRuntime.onLegalMove(completedMoveId);
          return;
        }
        drawScene(false);
      });
      group.on("mouseover", () => {
        const target = group as KonvaNode;
        target.to?.({ scaleX: 1.06, scaleY: 1.06, duration: 0.12 });
      });
      group.on("mouseout", () => {
        const target = group as KonvaNode;
        target.to?.({ scaleX: 1, scaleY: 1, duration: 0.12 });
      });
      void Konva;
    }

    function drawPassAction(
      Konva: KonvaNamespace,
      layer: KonvaLayer,
      game: BackgammonGameState
    ): void {
      const passMove = game.legalMoves.find((move) => move.pass === true);
      if (passMove === undefined || activeCanUserMove !== true) {
        return;
      }
      const label = readText(deps, ["xox", "board", "passMove"], "Pass");
      const group = new Konva.Group({ x: 392, y: 258 });
      group.add(
        new Konva.Rect({
          x: 0,
          y: 0,
          width: 196,
          height: 68,
          cornerRadius: 18,
          fill: "rgba(5,14,21,0.82)",
          stroke: "rgba(121,211,196,0.52)",
          strokeWidth: 2,
          shadowColor: "rgba(0,0,0,0.34)",
          shadowBlur: 18,
        })
      );
      group.add(
        new Konva.Text({
          x: 0,
          y: 23,
          width: 196,
          align: "center",
          text: label,
          fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
          fontSize: 18,
          fontStyle: "bold",
          fill: "#79d1c2",
        })
      );
      group.on("click tap", () => deps.stateRuntime.onLegalMove(passMove.id));
      layer.add(group);
    }

    function drawUndoAction(Konva: KonvaNamespace, layer: KonvaLayer, redraw: () => void): void {
      if (stagedMoves.length === 0) {
        return;
      }
      const group = new Konva.Group({ x: 628, y: 540 });
      group.add(
        new Konva.Rect({
          x: 0,
          y: 0,
          width: 106,
          height: 32,
          cornerRadius: 10,
          fill: "rgba(5,14,21,0.78)",
          stroke: "rgba(245,223,170,0.34)",
          strokeWidth: 1,
        })
      );
      group.add(
        new Konva.Text({
          x: 0,
          y: 9,
          width: 106,
          align: "center",
          text: readText(deps, ["xox", "board", "undoStage"], "Undo"),
          fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
          fontSize: 11,
          fontStyle: "bold",
          fill: "#f5dfaa",
        })
      );
      group.on("click tap", () => {
        stagedMoves = [];
        redraw();
      });
      layer.add(group);
    }

    function drawScene(Konva: KonvaNamespace, animateDice: boolean): void {
      if (stage === null || activeGame === null) {
        return;
      }
      stage.destroyChildren();
      const metrics = buildMetrics();
      const boardLayer = new Konva.Layer();
      const highlightLayer = new Konva.Layer();
      const checkerLayer = new Konva.Layer();
      const uiLayer = new Konva.Layer();
      stage.add(boardLayer, highlightLayer, checkerLayer, uiLayer);

      const snapshot = applyPreview(activeGame, stagedMoves);
      const candidates =
        activeCanUserMove === true ? getNextSubMoves(activeGame.legalMoves, stagedMoves) : [];

      drawBoardBase(Konva, boardLayer, metrics);
      drawPoints(Konva, boardLayer, metrics);
      candidates.forEach((candidate) => {
        drawTargetHighlight(Konva, highlightLayer, metrics, candidate.from, "source");
        drawTargetHighlight(Konva, highlightLayer, metrics, candidate.to, "target");
      });
      drawCheckers(Konva, checkerLayer, snapshot, metrics, candidates, (group, source) =>
        attachDragHandlers(Konva, group, source, () => drawScene(Konva, false), metrics)
      );
      drawDice(Konva, uiLayer, metrics, activeGame.dice, animateDice);
      drawStatusText(Konva, uiLayer, activeGame, candidates.length);
      drawUndoAction(Konva, uiLayer, () => drawScene(Konva, false));
      drawPassAction(Konva, uiLayer, activeGame);
      stage.batchDraw();
    }

    function drawStatusText(
      Konva: KonvaNamespace,
      layer: KonvaLayer,
      game: BackgammonGameState,
      candidateCount: number
    ): void {
      const hint =
        activeCanUserMove === true
          ? stagedMoves.length > 0
            ? readText(deps, ["xox", "board", "dragActiveHint"], "Complete the staged move.")
            : readText(deps, ["xox", "board", "dragHint"], "Drag a checker to a highlighted point.")
          : game.awaitingMoveFrom === "ai"
            ? readText(deps, ["xox", "board", "opponentThinking"], "Opponent is choosing a move.")
            : readText(deps, ["xox", "board", "stageIdle"], "Start a match to open the board.");
      layer.add(
        new Konva.Text({
          x: 56,
          y: 552,
          width: 680,
          text: hint,
          fontFamily: "Avenir Next, Segoe UI, sans-serif",
          fontSize: 14,
          fill: activeCanUserMove === true ? "#dffbf4" : "rgba(237,243,246,0.62)",
        })
      );
      layer.add(
        new Konva.Text({
          x: 810,
          y: 520,
          width: 124,
          align: "center",
          text:
            candidateCount > 0
              ? `${candidateCount} ${readText(deps, ["xox", "board", "targetCount"], "targets")}`
              : readText(deps, ["xox", "board", "noTargetCount"], "no target"),
          fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
          fontSize: 11,
          fill: "rgba(237,243,246,0.62)",
        })
      );
    }

    function renderFallback(host: HTMLElement, options: BackgammonStageRenderOptions): void {
      const fallback = deps.createElement("div", "xox-backgammon-stage__fallback", "");
      fallback.append(
        deps.createElement(
          "p",
          "xox-context-card__lead",
          readText(deps, ["xox", "board", "stageFallback"], "Visual board engine is loading.")
        )
      );
      const move = options.game.legalMoves[0];
      if (options.canUserMove && move !== undefined) {
        const button = deps.createElement("button", "xox-button xox-button--primary", move.label);
        button.addEventListener("click", () => deps.stateRuntime.onLegalMove(move.id));
        fallback.append(button);
      }
      host.replaceChildren(fallback);
    }

    function renderBackgammonStage(host: HTMLElement, options: BackgammonStageRenderOptions): void {
      activeGame = options.game;
      activeCanUserMove = options.canUserMove;
      const diceChanged = resetStagedMovesIfNeeded(options.game);
      const Konva = global.Konva;
      if (!isKonvaNamespace(Konva)) {
        destroy();
        renderFallback(host, options);
        return;
      }

      if (stage !== null && mountedHost !== host) {
        destroy();
      }

      if (stage === null) {
        host.replaceChildren();
        stage = new Konva.Stage({
          container: host as HTMLDivElement,
          width: WIDTH,
          height: HEIGHT,
        });
        mountedHost = host;
      }

      drawScene(Konva, diceChanged);
    }

    return {
      destroy,
      renderBackgammonStage,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
