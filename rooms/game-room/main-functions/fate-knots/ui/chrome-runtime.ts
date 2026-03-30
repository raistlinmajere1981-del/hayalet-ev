(function (global: GameRoomUiGlobal) {
  interface FateKnotsUiChromeRuntimeDeps {
    KNOWN_SEAT_IDS: string[];
    createElement: GameRoomCreateElement;
    appendImage: GameRoomAppendImage;
    applyAssetLayers: GameRoomApplyAssetLayers;
    applyFrameArtwork: GameRoomApplyFrameArtwork;
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

  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  function readSlotRecord(value: unknown): GameRoomFateKnotsSlotRecord | null {
    return value && typeof value === "object" && Array.isArray(value) === false
      ? (value as GameRoomFateKnotsSlotRecord)
      : null;
  }

  const registry = getFactoryRegistry(global);

  registry.createFateKnotsUiChromeRuntime = function createFateKnotsUiChromeRuntime(
    deps: FateKnotsUiChromeRuntimeDeps
  ): GameRoomFateKnotsUiChromeRuntime {
    const KNOWN_SEAT_IDS = deps.KNOWN_SEAT_IDS;
    const createElement = deps.createElement;
    const appendImage = deps.appendImage;
    const applyAssetLayers = deps.applyAssetLayers;
    const applyFrameArtwork = deps.applyFrameArtwork;
    const createFrame = deps.createFrame;
    const createRegion = deps.createRegion;
    const createSigil = deps.createSigil;
    const createTextChip = deps.createTextChip;
    const findParticipant = deps.findParticipant;
    const formatDeadline = deps.formatDeadline;
    const getCurrentStatus = deps.getCurrentStatus;
    const getPhaseLabel = deps.getPhaseLabel;
    const getSelectionBundle = deps.getSelectionBundle;
    const getUiAsset = deps.getUiAsset;
    const setSeatId = deps.setSeatId;
    const t = deps.t;

    function createSeatStateText(
      _state: GameRoomFateKnotsState,
      seatDisplay: GameRoomFateKnotsSeatDisplay
    ): string {
      if (seatDisplay.liveParticipant) {
        if (seatDisplay.liveParticipant.selection.locked) {
          return t(["fateKnots", "seatState", "locked"], "Locked");
        }
        if (seatDisplay.liveParticipant.ready) {
          return t(["fateKnots", "seatState", "ready"], "Ready");
        }
        return t(["fateKnots", "seatState", "selecting"], "Selecting");
      }
      if (seatDisplay.excludedReason) {
        return t(["fateKnots", "seatState", "deferred"], "Deferred");
      }
      if (seatDisplay.slotRecord?.connected === false) {
        return t(["fateKnots", "seatState", "reserved"], "Reserved");
      }
      return t(["fateKnots", "seatState", "standby"], "Standby");
    }

    function createSeatLabel(_state: GameRoomFateKnotsState, seatId: string): string {
      const labelMap: Record<string, string> = {
        user: t(["fateKnots", "seats", "user"], "You"),
        ai1: t(["fateKnots", "seats", "ai1"], "AI1"),
        ai2: t(["fateKnots", "seats", "ai2"], "AI2"),
        us1: t(["fateKnots", "seats", "us1"], "US1"),
      };
      return labelMap[seatId] || seatId.toUpperCase();
    }

    function getContextSlotRecord(
      state: GameRoomFateKnotsState,
      seatId: string
    ): GameRoomFateKnotsSlotRecord | null {
      const slots = state.context?.slots;
      if (!slots) {
        return null;
      }
      return readSlotRecord(slots[seatId] ?? null);
    }

    function getExcludedSeatReason(state: GameRoomFateKnotsState, seatId: string): string | null {
      const match =
        state.excludedSeats.find(function (entry: GameRoomFateKnotsExcludedSeatRecord) {
          return entry.seatId === seatId;
        }) || null;
      return match?.reason || null;
    }

    function buildSeatDisplay(
      state: GameRoomFateKnotsState,
      seatId: string
    ): GameRoomFateKnotsSeatDisplay {
      const liveParticipant = findParticipant(state, seatId);
      const slotRecord = getContextSlotRecord(state, seatId);
      const excludedReason = getExcludedSeatReason(state, seatId);
      const bundle = liveParticipant ? getSelectionBundle(state, liveParticipant) : null;
      const title = liveParticipant
        ? liveParticipant.nickname
        : slotRecord?.nickname
          ? slotRecord.nickname
          : createSeatLabel(state, seatId);
      const portraitAsset = bundle?.avatar || null;
      const summaryLines: string[] = [];

      if (bundle && (bundle.avatar || bundle.classDef || bundle.background)) {
        summaryLines.push(
          [
            bundle.avatar ? bundle.avatar.label : "-",
            bundle.classDef ? bundle.classDef.label : "-",
            bundle.background ? bundle.background.label : "-",
          ].join(" / ")
        );
      }

      if (!liveParticipant && excludedReason) {
        summaryLines.push(
          t(
            ["fateKnots", "roster", "excluded"],
            "US1 stays outside the V1 playable roster and is tracked for later iterations."
          )
        );
      } else if (!liveParticipant && slotRecord?.remoteUserId) {
        summaryLines.push(slotRecord.remoteUserId);
      }

      const seatDisplay: GameRoomFateKnotsSeatDisplay = {
        seatId: seatId,
        liveParticipant: liveParticipant,
        slotRecord: slotRecord,
        excludedReason: excludedReason,
        bundle: bundle,
        title: title,
        stateText: "",
        eyebrow: createSeatLabel(state, seatId),
        portraitAsset: portraitAsset,
        summaryLines: summaryLines,
        isDummy: !liveParticipant,
        isLocal: seatId === "user",
        emblemAsset:
          seatId === "user"
            ? getUiAsset("mapCrest")
            : seatId === "ai1"
              ? getUiAsset("targetMarker")
              : seatId === "ai2"
                ? getUiAsset("diceBadge")
                : getUiAsset("turnBadge"),
      };
      return {
        ...seatDisplay,
        stateText: createSeatStateText(state, seatDisplay),
      };
    }

    function appendNpcBanter(
      parent: HTMLElement,
      state: GameRoomFateKnotsState,
      seatId: string
    ): void {
      if (!state.npcBanter?.text || state.npcBanter.seatId !== seatId) {
        return;
      }
      const bubble = createRegion("div", "fk-seat-banter", null);
      bubble.append(createElement("span", "fk-seat-banter__label", seatId.toUpperCase()));
      bubble.append(createElement("p", "fk-seat-banter__text", state.npcBanter.text));
      parent.append(bubble);
    }

    function createSeatPlaque(
      state: GameRoomFateKnotsState,
      seatId: string,
      role: string
    ): HTMLElement {
      const seat = buildSeatDisplay(state, seatId);
      const plaque = createFrame(
        "article",
        "fk-seat-plaque" +
          (seat.isDummy ? " fk-seat-plaque--dummy" : "") +
          (seat.isLocal ? " fk-seat-plaque--local" : ""),
        role || "seat-plaque",
        {
          overlay: seat.isDummy ? getUiAsset("fogPatch") : getUiAsset("parchmentStain"),
          frame: getUiAsset("sidePanelFrame"),
          texture: seat.isDummy ? getUiAsset("darkPanel") : getUiAsset("defaultPanel"),
        }
      );
      setSeatId(plaque, seatId);
      plaque.append(
        createSigil(
          "fk-seat-plaque__crest",
          seat.emblemAsset,
          seat.isDummy ? getUiAsset("fogPatch") : getUiAsset("lightGlowPatch")
        )
      );
      const header = createRegion("div", "fk-seat-plaque__header", null);
      header.append(createElement("span", "fk-seat-plaque__eyebrow", seat.eyebrow));
      header.append(
        createTextChip(seat.stateText, seat.isDummy ? "soft" : seat.isLocal ? "accent" : "warm")
      );
      plaque.append(header);
      const body = createRegion("div", "fk-seat-plaque__body", null);
      if (seat.portraitAsset) {
        appendImage(body, "fk-seat-plaque__portrait", seat.portraitAsset, seat.title);
      } else {
        body.append(
          createSigil(
            "fk-seat-plaque__placeholder",
            seat.emblemAsset,
            seat.isDummy ? getUiAsset("fogPatch") : getUiAsset("parchmentStain")
          )
        );
      }
      const copy = createRegion("div", "fk-seat-plaque__copy", null);
      copy.append(createElement("strong", "fk-seat-plaque__title", seat.title));
      seat.summaryLines.forEach(function (line: string) {
        copy.append(createElement("p", "fk-seat-plaque__summary", line));
      });
      body.append(copy);
      plaque.append(body);
      appendNpcBanter(plaque, state, seatId);
      return plaque;
    }

    function createSeatRibbon(
      state: GameRoomFateKnotsState,
      role: string,
      activeSeatId: string | null
    ): HTMLElement {
      const ribbon = createRegion("div", "fk-seat-ribbon", role || "seat-ribbon");
      KNOWN_SEAT_IDS.forEach(function (seatId: string) {
        const seat = buildSeatDisplay(state, seatId);
        const chip = createRegion(
          "div",
          "fk-seat-ribbon__chip" +
            (seat.isDummy ? " fk-seat-ribbon__chip--dummy" : "") +
            (activeSeatId === seatId ? " fk-seat-ribbon__chip--active" : ""),
          null
        );
        setSeatId(chip, seatId);
        chip.append(createElement("span", "fk-seat-ribbon__name", seat.eyebrow));
        chip.append(createElement("span", "fk-seat-ribbon__state", seat.stateText));
        if (state.npcBanter?.text && state.npcBanter.seatId === seatId) {
          chip.append(createElement("span", "fk-seat-ribbon__state", state.npcBanter.text));
        }
        ribbon.append(chip);
      });
      return ribbon;
    }

    function createTopbar(state: GameRoomFateKnotsState, phaseId: string): HTMLElement {
      const topbar = createFrame("header", "fk-topbar fk-topbar--" + phaseId, "ritual-header", {
        overlay: getUiAsset("lightGlowPatch"),
        overlaySize: "100% 100%",
        frame: getUiAsset("topStatusBar"),
        texture: getUiAsset("darkPanel"),
      });
      topbar.append(
        createSigil(
          "fk-topbar__sigil fk-topbar__sigil--left",
          getUiAsset("mapCrest"),
          getUiAsset("subtleRuneOverlay")
        )
      );
      const titleCluster = createRegion("div", "fk-topbar__cluster", null);
      titleCluster.append(
        createElement(
          "p",
          "fk-topbar__eyebrow",
          t(["fateKnots", "heroBadge"], "Game Room") + " • " + getPhaseLabel(phaseId)
        )
      );
      titleCluster.append(
        createElement("h1", "fk-topbar__title", t(["fateKnots", "heroTitle"], "Fate Knots"))
      );
      titleCluster.append(createElement("p", "fk-topbar__subtitle", getCurrentStatus(state)));
      topbar.append(titleCluster);

      const statusCluster = createRegion("div", "fk-topbar__meta", null);
      statusCluster.append(createTextChip(getPhaseLabel(phaseId), "soft"));
      if (state.waiting.pendingSeatIds.length > 0) {
        statusCluster.append(
          createTextChip(
            t(["fateKnots", "status", "pendingSeats"], "Pending") +
              ": " +
              state.waiting.pendingSeatIds.join(", "),
            "alert"
          )
        );
      }
      if (state.compatibility.mode !== "fresh") {
        statusCluster.append(createTextChip(state.compatibility.mode, "alert"));
      }
      if (state.waiting.deadlineAt) {
        statusCluster.append(
          createTextChip(
            t(["fateKnots", "status", "deadline"], "Deadline") +
              ": " +
              formatDeadline(state.waiting.deadlineAt),
            "warm"
          )
        );
      }
      topbar.append(statusCluster);
      topbar.append(
        createSigil(
          "fk-topbar__sigil fk-topbar__sigil--right",
          phaseId === "combat" ? getUiAsset("turnBadge") : getUiAsset("targetRing"),
          getUiAsset("subtleRuneOverlay")
        )
      );
      return topbar;
    }

    function createCoverageLedger(state: GameRoomFateKnotsState): HTMLElement {
      const ledger = createFrame(
        "section",
        "fk-stage-frame fk-stage-frame--ledger fk-coverage-ledger",
        "coverage-ledger"
      );
      ledger.append(
        createElement(
          "p",
          "fk-frame__eyebrow",
          t(["fateKnots", "coverage", "title"], "Visible Asset Coverage")
        )
      );
      const grid = createRegion("div", "fk-ledger__grid", null);
      Object.keys(state.assetCoverage).forEach(function (key: string) {
        const item = createRegion("div", "fk-ledger__item", null);
        item.append(createElement("span", "fk-ledger__label", key));
        item.append(
          createElement("strong", "fk-ledger__value", String(state.assetCoverage[key]))
        );
        grid.append(item);
      });
      const assetErrors = createRegion("div", "fk-ledger__item", null);
      assetErrors.append(createElement("span", "fk-ledger__label", "assetErrors"));
      assetErrors.append(
        createElement(
          "strong",
          "fk-ledger__value",
          String(state.contentSummary?.assetErrors || 0)
        )
      );
      grid.append(assetErrors);
      const sourceErrors = createRegion("div", "fk-ledger__item", null);
      sourceErrors.append(createElement("span", "fk-ledger__label", "sourceErrors"));
      sourceErrors.append(
        createElement(
          "strong",
          "fk-ledger__value",
          String(state.contentSummary?.sourceErrors || 0)
        )
      );
      grid.append(sourceErrors);
      ledger.append(grid);
      if ((state.contentErrors || []).length > 0) {
        ledger.append(
          createElement("p", "fk-frame__hint", (state.contentErrors || []).join(" | "))
        );
      }
      return ledger;
    }

    function applySurfaceBackdrop(surface: HTMLElement, _state: GameRoomFateKnotsState): void {
      const featureView = getUiAsset("featureView");
      applyAssetLayers(surface, [
        {
          asset: getUiAsset("vignettePatch"),
          size: "cover",
          position: "center",
          blend: "multiply",
        },
        {
          asset: getUiAsset("subtleRuneOverlay"),
          size: "cover",
          position: "center",
          blend: "screen",
        },
        { asset: getUiAsset("fogPatch"), size: "cover", position: "center", blend: "screen" },
        { asset: featureView, size: "cover", position: "center", blend: "normal" },
      ]);
    }

    function createSurfaceCorner(role: string, asset: unknown): HTMLElement {
      const corner = createRegion("div", "fk-surface__corner fk-surface__corner--" + role, null);
      applyFrameArtwork(corner, { texture: asset });
      return corner;
    }

    return {
      appendNpcBanter: appendNpcBanter,
      applySurfaceBackdrop: applySurfaceBackdrop,
      buildSeatDisplay: buildSeatDisplay,
      createCoverageLedger: createCoverageLedger,
      createSeatLabel: createSeatLabel,
      createSeatPlaque: createSeatPlaque,
      createSeatRibbon: createSeatRibbon,
      createSurfaceCorner: createSurfaceCorner,
      createTopbar: createTopbar,
    };
  };
})((typeof window !== "undefined" ? window : globalThis) as unknown as GameRoomUiGlobal);
