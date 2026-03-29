(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiChromeRuntime = function createFateKnotsUiChromeRuntime(deps) {
    const KNOWN_SEAT_IDS = deps.KNOWN_SEAT_IDS;
    const createDefaultAsset = deps.createDefaultAsset;
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

    function createSeatStateText(state, seatDisplay) {
      if (seatDisplay.liveParticipant) {
        if (seatDisplay.liveParticipant.selection && seatDisplay.liveParticipant.selection.locked) {
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
      if (seatDisplay.slotRecord && seatDisplay.slotRecord.connected === false) {
        return t(["fateKnots", "seatState", "reserved"], "Reserved");
      }
      return t(["fateKnots", "seatState", "standby"], "Standby");
    }

    function createSeatLabel(state, seatId) {
      const labelMap = {
        user: t(["fateKnots", "seats", "user"], "You"),
        ai1: t(["fateKnots", "seats", "ai1"], "AI1"),
        ai2: t(["fateKnots", "seats", "ai2"], "AI2"),
        us1: t(["fateKnots", "seats", "us1"], "US1"),
      };
      return labelMap[seatId] || seatId.toUpperCase();
    }

    function getContextSlotRecord(state, seatId) {
      return state && state.context && state.context.slots && state.context.slots[seatId]
        ? state.context.slots[seatId]
        : null;
    }

    function getExcludedSeatReason(state, seatId) {
      if (!Array.isArray(state.excludedSeats)) {
        return null;
      }
      const match = state.excludedSeats.find(function (entry) {
        return entry && typeof entry === "object" && entry.seatId === seatId;
      });
      return match && typeof match.reason === "string" ? match.reason : null;
    }

    function buildSeatDisplay(state, seatId) {
      const liveParticipant = findParticipant(state, seatId);
      const slotRecord = getContextSlotRecord(state, seatId);
      const excludedReason = getExcludedSeatReason(state, seatId);
      const bundle = liveParticipant ? getSelectionBundle(state, liveParticipant) : null;
      const title = liveParticipant
        ? liveParticipant.nickname
        : slotRecord && slotRecord.nickname
          ? slotRecord.nickname
          : createSeatLabel(state, seatId);
      const portraitAsset = bundle && bundle.avatar ? bundle.avatar : null;
      const summaryLines = [];
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
      } else if (!liveParticipant && slotRecord && slotRecord.remoteUserId) {
        summaryLines.push(slotRecord.remoteUserId);
      }
      return {
        seatId: seatId,
        liveParticipant: liveParticipant,
        slotRecord: slotRecord,
        excludedReason: excludedReason,
        bundle: bundle,
        title: title,
        stateText: createSeatStateText(state, {
          liveParticipant: liveParticipant,
          slotRecord: slotRecord,
          excludedReason: excludedReason,
        }),
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
    }

    function appendNpcBanter(parent, state, seatId) {
      if (!state.npcBanter || state.npcBanter.seatId !== seatId || !state.npcBanter.text) {
        return;
      }
      const bubble = createRegion("div", "fk-seat-banter", null);
      bubble.append(createElement("span", "fk-seat-banter__label", seatId.toUpperCase()));
      bubble.append(createElement("p", "fk-seat-banter__text", state.npcBanter.text));
      parent.append(bubble);
    }

    function createSeatPlaque(state, seatId, role) {
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
      seat.summaryLines.forEach(function (line) {
        copy.append(createElement("p", "fk-seat-plaque__summary", line));
      });
      body.append(copy);
      plaque.append(body);
      appendNpcBanter(plaque, state, seatId);
      return plaque;
    }

    function createSeatRibbon(state, role, activeSeatId) {
      const ribbon = createRegion("div", "fk-seat-ribbon", role || "seat-ribbon");
      KNOWN_SEAT_IDS.forEach(function (seatId) {
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
        if (state.npcBanter && state.npcBanter.seatId === seatId && state.npcBanter.text) {
          chip.append(createElement("span", "fk-seat-ribbon__state", state.npcBanter.text));
        }
        ribbon.append(chip);
      });
      return ribbon;
    }

    function createTopbar(state, phaseId) {
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
      if (
        state.waiting &&
        Array.isArray(state.waiting.pendingSeatIds) &&
        state.waiting.pendingSeatIds.length > 0
      ) {
        statusCluster.append(
          createTextChip(
            t(["fateKnots", "status", "pendingSeats"], "Pending") +
              ": " +
              state.waiting.pendingSeatIds.join(", "),
            "alert"
          )
        );
      }
      if (state.compatibility && state.compatibility.mode !== "fresh") {
        statusCluster.append(createTextChip(state.compatibility.mode, "alert"));
      }
      if (state.waiting && state.waiting.deadlineAt) {
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

    function createCoverageLedger(state) {
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
      Object.keys(state.assetCoverage || {}).forEach(function (key) {
        const item = createRegion("div", "fk-ledger__item", null);
        item.append(createElement("span", "fk-ledger__label", key));
        item.append(createElement("strong", "fk-ledger__value", String(state.assetCoverage[key])));
        grid.append(item);
      });
      const assetErrors = createRegion("div", "fk-ledger__item", null);
      assetErrors.append(createElement("span", "fk-ledger__label", "assetErrors"));
      assetErrors.append(
        createElement("strong", "fk-ledger__value", String(state.contentSummary.assetErrors || 0))
      );
      grid.append(assetErrors);
      const sourceErrors = createRegion("div", "fk-ledger__item", null);
      sourceErrors.append(createElement("span", "fk-ledger__label", "sourceErrors"));
      sourceErrors.append(
        createElement("strong", "fk-ledger__value", String(state.contentSummary.sourceErrors || 0))
      );
      grid.append(sourceErrors);
      ledger.append(grid);
      if (state.contentErrors.length > 0) {
        ledger.append(createElement("p", "fk-frame__hint", state.contentErrors.join(" | ")));
      }
      return ledger;
    }

    function applySurfaceBackdrop(surface, state) {
      const featureView =
        state.uiAssets && state.uiAssets.featureView
          ? state.uiAssets.featureView
          : createDefaultAsset(null);
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

    function createSurfaceCorner(role, asset) {
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
})(typeof window !== "undefined" ? window : globalThis);
