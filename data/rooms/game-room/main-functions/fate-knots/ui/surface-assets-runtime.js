(function(global) {
  function getFactoryRegistry(host) {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }
  const registry = getFactoryRegistry(global);
  registry.createFateKnotsUiSurfaceAssetsRuntime = function createFateKnotsUiSurfaceAssetsRuntime(deps) {
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
      turnBadge: "turn_badge"
    });
    const reportedMissingAssets = {};
    const preloadedUiSources = {};
    function isDevMode() {
      const locationRef = globalThis.location;
      if (!locationRef) {
        return false;
      }
      return locationRef.hostname === "localhost" || locationRef.hostname === "127.0.0.1" || locationRef.protocol === "file:";
    }
    function warnMissingUiAsset(key, assetId) {
      const warningKey = key + "::" + assetId;
      if (reportedMissingAssets[warningKey]) {
        return;
      }
      reportedMissingAssets[warningKey] = true;
      if (isDevMode() && typeof globalThis.console.warn === "function") {
        globalThis.console.warn(
          '[FateKnotsUI] Missing UI asset "' + assetId + '" for alias "' + key + '".'
        );
      }
    }
    function getUiAssetRegistry() {
      const state = getCurrentState();
      return state ? state.uiAssets.byId : {};
    }
    function createMissingUiAsset(key, assetId) {
      const missingAsset = createDefaultAsset(assetId);
      missingAsset.missingUiAsset = true;
      missingAsset.missingUiAssetKey = key;
      missingAsset.expectedAssetId = assetId;
      warnMissingUiAsset(key, assetId);
      return missingAsset;
    }
    function getUiAsset(key) {
      const assetId = UI_ASSET_ALIASES[key] || key;
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
    function assetUrl(assetLink) {
      const normalized = sanitizeAssetLink(assetLink);
      return normalized.uiSrc || normalized.src || "";
    }
    function ensureUiAssetsPreloaded() {
      const ImageCtor = globalThis.Image;
      if (typeof ImageCtor !== "function") {
        return;
      }
      Object.keys(getUiAssetRegistry()).forEach(function(assetId) {
        const source = assetUrl(getUiAsset(assetId));
        if (!source || preloadedUiSources[source]) {
          return;
        }
        preloadedUiSources[source] = true;
        const image = new ImageCtor();
        image.src = source;
      });
    }
    return {
      ensureUiAssetsPreloaded,
      getUiAsset
    };
  };
})(window);
