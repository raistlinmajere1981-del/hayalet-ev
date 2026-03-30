(function (global: any) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiSurfaceAssetsRuntime = function createFateKnotsUiSurfaceAssetsRuntime(deps: any) {
    const sanitizeAssetLink = deps.sanitizeAssetLink;
    const createDefaultAsset = deps.createDefaultAsset;
    const getCurrentState = deps.getCurrentState;

    const UI_ASSET_ALIASES = Object.freeze({
      featureView: "fate-knots-view",
      activeGlowPanel: "active_glow_panel",
      choiceButton: "choice_button",
      darkPanel: "dark_panel",
      defaultPanel: "default_panel",
      disabledPanel: "disabled_panel",
      primaryButton: "primary_button",
      secondaryButton: "secondary_button",
      buttonPlate: "button_plate",
      cardSlotFrame: "card_slot_frame",
      logPanelFrame: "log_panel_frame",
      mainSceneFrame: "main_scene_frame",
      sidePanelFrame: "side_panel_frame",
      topStatusBar: "top_status_bar",
      avatarCardTemplate: "avatar_card_template",
      classCardTemplate: "class_card_template",
      creatureCardTemplate: "creature_card_template",
      itemCardTemplate: "item_card_template",
      locationCardTemplate: "location_card_template",
      cardDisabled: "card_disabled",
      cardFocusBorder: "card_focus_border",
      cardHoverGlow: "card_hover_glow",
      cardSelected: "card_selected",
      logPanel: "log_panel",
      notificationBanner: "notification_banner",
      systemMessageBox: "system_message_box",
      targetRing: "target_ring",
      turnIndicator: "turn_indicator",
      turnOrderMarker: "turn_order_marker",
      diceBadge: "dice_badge",
      shield: "shield",
      targetMarker: "target_marker",
      activeMarker: "active_marker",
      hoverRing: "hover_ring",
      lockedMarker: "locked_marker",
      mapMarker: "map_marker",
      mapCrest: "map_ui_crest",
      pathSegment: "path_segment",
      selectionGlow: "selection_glow",
      cornerOrnament: "corner_ornament",
      fogPatch: "fog_patch",
      lightGlowPatch: "light_glow_patch",
      parchmentStain: "parchment_stain",
      subtleRuneOverlay: "subtle_rune_overlay",
      vignettePatch: "vignette_patch",
      buffIndicator: "buff_indicator",
      debuffIndicator: "debuff_indicator",
      healthBar: "health_bar",
      manaBar: "mana_bar",
      statusSlot: "status_slot",
      turnBadge: "turn_badge",
    });

    const reportedMissingAssets = Object.create(null);
    const preloadedUiSources = Object.create(null);

    function isDevMode() {
      const location = global.location;
      if (!location || typeof location !== "object") {
        return true;
      }
      return (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.protocol === "file:"
      );
    }

    function warnMissingUiAsset(key: any, assetId: any) {
      const warningKey = key + "::" + assetId;
      if (reportedMissingAssets[warningKey]) {
        return;
      }
      reportedMissingAssets[warningKey] = true;
      if (isDevMode() && global.console && typeof global.console.warn === "function") {
        global.console.warn(
          '[FateKnotsUI] Missing UI asset "' + assetId + '" for alias "' + key + '".'
        );
      }
    }

    function getUiAssetRegistry() {
      const state =
        typeof getCurrentState === "function" && getCurrentState() ? getCurrentState() : null;
      const uiAssets =
        state && state.uiAssets && typeof state.uiAssets === "object" ? state.uiAssets : null;
      return uiAssets && uiAssets.byId && typeof uiAssets.byId === "object" ? uiAssets.byId : {};
    }

    function createMissingUiAsset(key: any, assetId: any) {
      const missingAsset = createDefaultAsset(assetId);
      missingAsset.missingUiAsset = true;
      missingAsset.missingUiAssetKey = key;
      missingAsset.expectedAssetId = assetId;
      warnMissingUiAsset(key, assetId);
      return missingAsset;
    }

    function getUiAsset(key: any) {
      const aliases = UI_ASSET_ALIASES as Record<string, string>;
      const assetId = aliases[String(key)] || String(key);
      const candidate = getUiAssetRegistry()[assetId];
      if (!candidate) {
        return createMissingUiAsset(key, assetId);
      }
      const normalized = sanitizeAssetLink(candidate);
      if (!normalized.uiSrc) {
        return createMissingUiAsset(key, assetId);
      }
      return normalized;
    }

    function assetUrl(assetLink: any) {
      const normalized = sanitizeAssetLink(assetLink);
      return normalized.uiSrc || normalized.src || "";
    }

    function ensureUiAssetsPreloaded() {
      if (typeof global.Image !== "function") {
        return;
      }
      Object.keys(getUiAssetRegistry()).forEach(function (assetId: any) {
        const source = assetUrl(getUiAsset(assetId));
        if (!source || preloadedUiSources[source]) {
          return;
        }
        preloadedUiSources[source] = true;
        const image = new global.Image();
        image.src = source;
      });
    }

    return {
      ensureUiAssetsPreloaded: ensureUiAssetsPreloaded,
      getUiAsset: getUiAsset,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
