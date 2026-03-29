(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiSurfaceAssetsRuntime = function createFateKnotsUiSurfaceAssetsRuntime(
    deps
  ) {
    const sanitizeAssetLink = deps.sanitizeAssetLink;
    const createDefaultAsset = deps.createDefaultAsset;

    const UI_ASSET_ROOT = "../main-functions/fate-knots/assets/ui/";

    function createStaticUiAsset(assetId, relativeUiPath) {
      return sanitizeAssetLink({
        assetId: assetId,
        uiSrc: relativeUiPath,
        src: relativeUiPath.replace(/^\.\.\//, ""),
      });
    }

    const UI_ASSETS = Object.freeze({
      activeGlowPanel: createStaticUiAsset(
        "active_glow_panel",
        UI_ASSET_ROOT + "buttons/active_glow_panel.webp"
      ),
      choiceButton: createStaticUiAsset(
        "choice_button",
        UI_ASSET_ROOT + "buttons/choice_button.webp"
      ),
      darkPanel: createStaticUiAsset("dark_panel", UI_ASSET_ROOT + "buttons/dark_panel.webp"),
      defaultPanel: createStaticUiAsset(
        "default_panel",
        UI_ASSET_ROOT + "buttons/default_panel.webp"
      ),
      disabledPanel: createStaticUiAsset(
        "disabled_panel",
        UI_ASSET_ROOT + "buttons/disabled_panel.webp"
      ),
      primaryButton: createStaticUiAsset(
        "primary_button",
        UI_ASSET_ROOT + "buttons/primary_button.webp"
      ),
      secondaryButton: createStaticUiAsset(
        "secondary_button",
        UI_ASSET_ROOT + "buttons/secondary_button.webp"
      ),
      buttonPlate: createStaticUiAsset("button_plate", UI_ASSET_ROOT + "frames/button_plate.webp"),
      cardSlotFrame: createStaticUiAsset(
        "card_slot_frame",
        UI_ASSET_ROOT + "frames/card_slot_frame.webp"
      ),
      logPanelFrame: createStaticUiAsset(
        "log_panel_frame",
        UI_ASSET_ROOT + "frames/log_panel_frame.webp"
      ),
      mainSceneFrame: createStaticUiAsset(
        "main_scene_frame",
        UI_ASSET_ROOT + "frames/main_scene_frame.webp"
      ),
      sidePanelFrame: createStaticUiAsset(
        "side_panel_frame",
        UI_ASSET_ROOT + "frames/side_panel_frame.webp"
      ),
      topStatusBar: createStaticUiAsset(
        "top_status_bar",
        UI_ASSET_ROOT + "frames/top_status_bar.webp"
      ),
      avatarCardTemplate: createStaticUiAsset(
        "avatar_card_template",
        UI_ASSET_ROOT + "cards/avatar_card_template.webp"
      ),
      classCardTemplate: createStaticUiAsset(
        "class_card_template",
        UI_ASSET_ROOT + "cards/class_card_template.webp"
      ),
      creatureCardTemplate: createStaticUiAsset(
        "creature_card_template",
        UI_ASSET_ROOT + "cards/creature_card_template.webp"
      ),
      itemCardTemplate: createStaticUiAsset(
        "item_card_template",
        UI_ASSET_ROOT + "cards/item_card_template.webp"
      ),
      locationCardTemplate: createStaticUiAsset(
        "location_card_template",
        UI_ASSET_ROOT + "cards/location_card_template.webp"
      ),
      cardDisabled: createStaticUiAsset(
        "card_disabled",
        UI_ASSET_ROOT + "card-effects/card_disabled.webp"
      ),
      cardFocusBorder: createStaticUiAsset(
        "card_focus_border",
        UI_ASSET_ROOT + "card-effects/card_focus_border.webp"
      ),
      cardHoverGlow: createStaticUiAsset(
        "card_hover_glow",
        UI_ASSET_ROOT + "card-effects/card_hover_glow.webp"
      ),
      cardSelected: createStaticUiAsset(
        "card_selected",
        UI_ASSET_ROOT + "card-effects/card_selected.webp"
      ),
      logPanel: createStaticUiAsset("log_panel", UI_ASSET_ROOT + "dialogue/log_panel.webp"),
      notificationBanner: createStaticUiAsset(
        "notification_banner",
        UI_ASSET_ROOT + "dialogue/notification_banner.webp"
      ),
      systemMessageBox: createStaticUiAsset(
        "system_message_box",
        UI_ASSET_ROOT + "dialogue/system_message_box.webp"
      ),
      targetRing: createStaticUiAsset("target_ring", UI_ASSET_ROOT + "combat-fx/target_ring.webp"),
      turnIndicator: createStaticUiAsset(
        "turn_indicator",
        UI_ASSET_ROOT + "combat-fx/turn_indicator.webp"
      ),
      turnOrderMarker: createStaticUiAsset(
        "turn_order_marker",
        UI_ASSET_ROOT + "combat-fx/turn_order_marker.webp"
      ),
      diceBadge: createStaticUiAsset("dice_badge", UI_ASSET_ROOT + "combat-icons/dice_badge.webp"),
      shield: createStaticUiAsset("shield", UI_ASSET_ROOT + "combat-icons/shield.webp"),
      targetMarker: createStaticUiAsset(
        "target_marker",
        UI_ASSET_ROOT + "combat-icons/target_marker.webp"
      ),
      activeMarker: createStaticUiAsset("active_marker", UI_ASSET_ROOT + "map/active_marker.webp"),
      hoverRing: createStaticUiAsset("hover_ring", UI_ASSET_ROOT + "map/hover_ring.webp"),
      lockedMarker: createStaticUiAsset("locked_marker", UI_ASSET_ROOT + "map/locked_marker.webp"),
      mapMarker: createStaticUiAsset("map_marker", UI_ASSET_ROOT + "map/map_marker.webp"),
      mapCrest: createStaticUiAsset("map_ui_crest", UI_ASSET_ROOT + "map/map_ui_crest.webp"),
      pathSegment: createStaticUiAsset("path_segment", UI_ASSET_ROOT + "map/path_segment.webp"),
      selectionGlow: createStaticUiAsset(
        "selection_glow",
        UI_ASSET_ROOT + "map/selection_glow.webp"
      ),
      cornerOrnament: createStaticUiAsset(
        "corner_ornament",
        UI_ASSET_ROOT + "overlays/corner_ornament.webp"
      ),
      fogPatch: createStaticUiAsset("fog_patch", UI_ASSET_ROOT + "overlays/fog_patch.webp"),
      lightGlowPatch: createStaticUiAsset(
        "light_glow_patch",
        UI_ASSET_ROOT + "overlays/light_glow_patch.webp"
      ),
      parchmentStain: createStaticUiAsset(
        "parchment_stain",
        UI_ASSET_ROOT + "overlays/parchment_stain.webp"
      ),
      subtleRuneOverlay: createStaticUiAsset(
        "subtle_rune_overlay",
        UI_ASSET_ROOT + "overlays/subtle_rune_overlay.webp"
      ),
      vignettePatch: createStaticUiAsset(
        "vignette_patch",
        UI_ASSET_ROOT + "overlays/vignette_patch.webp"
      ),
      buffIndicator: createStaticUiAsset(
        "buff_indicator",
        UI_ASSET_ROOT + "status/buff_indicator.webp"
      ),
      debuffIndicator: createStaticUiAsset(
        "debuff_indicator",
        UI_ASSET_ROOT + "status/debuff_indicator.webp"
      ),
      healthBar: createStaticUiAsset("health_bar", UI_ASSET_ROOT + "status/health_bar.webp"),
      manaBar: createStaticUiAsset("mana_bar", UI_ASSET_ROOT + "status/mana_bar.webp"),
      statusSlot: createStaticUiAsset("status_slot", UI_ASSET_ROOT + "status/status_slot.webp"),
      turnBadge: createStaticUiAsset("turn_badge", UI_ASSET_ROOT + "status/turn_badge.webp"),
    });

    let hasPreloadedUiAssets = false;

    function getUiAsset(key) {
      return UI_ASSETS[key] || createDefaultAsset(null);
    }

    function assetUrl(assetLink) {
      const normalized = sanitizeAssetLink(assetLink);
      return normalized.uiSrc || normalized.src || "";
    }

    function ensureUiAssetsPreloaded() {
      if (hasPreloadedUiAssets) {
        return;
      }
      hasPreloadedUiAssets = true;
      if (typeof global.Image !== "function") {
        return;
      }
      Object.keys(UI_ASSETS).forEach(function (key) {
        const source = assetUrl(getUiAsset(key));
        if (!source) {
          return;
        }
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
