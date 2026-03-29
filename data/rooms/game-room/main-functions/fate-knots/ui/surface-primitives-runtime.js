(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createFateKnotsUiSurfacePrimitivesRuntime = function createFateKnotsUiSurfacePrimitivesRuntime(deps) {
    const createElement = deps.createElement;
    const sanitizeAssetLink = deps.sanitizeAssetLink;
    const getUiAsset = deps.getUiAsset;
    function createRegion(tagName, className, role) {
      const element = createElement(tagName, className || "");
      if (role) {
        element.dataset.fkRole = role;
      }
      return element;
    }
    function setSeatId(element, seatId) {
      if (element && seatId) {
        element.dataset.seatId = seatId;
      }
      return element;
    }
    function assetUrl(assetLink) {
      const normalized = sanitizeAssetLink(assetLink);
      return normalized.uiSrc || normalized.src || "";
    }
    function applyAssetLayers(element, layers) {
      const normalizedLayers = (Array.isArray(layers) ? layers : []).map(function(layer) {
        if (!layer) {
          return null;
        }
        const source = assetUrl(layer.asset || layer);
        if (!source) {
          return null;
        }
        return {
          url: source,
          size: layer.size || "cover",
          position: layer.position || "center",
          repeat: layer.repeat || "no-repeat",
          blend: layer.blend || "normal"
        };
      }).filter(Boolean);
      if (normalizedLayers.length === 0) {
        return;
      }
      element.style.backgroundImage = normalizedLayers.map(function(layer) {
        return 'url("' + layer.url + '")';
      }).join(", ");
      element.style.backgroundSize = normalizedLayers.map(function(layer) {
        return layer.size;
      }).join(", ");
      element.style.backgroundPosition = normalizedLayers.map(function(layer) {
        return layer.position;
      }).join(", ");
      element.style.backgroundRepeat = normalizedLayers.map(function(layer) {
        return layer.repeat;
      }).join(", ");
      element.style.backgroundBlendMode = normalizedLayers.map(function(layer) {
        return layer.blend;
      }).join(", ");
    }
    function applyFrameArtwork(element, options) {
      const config = options || {};
      applyAssetLayers(element, [
        config.overlay ? {
          asset: config.overlay,
          size: config.overlaySize || "cover",
          position: config.overlayPosition || "center",
          blend: config.overlayBlend || "screen"
        } : null,
        config.frame ? {
          asset: config.frame,
          size: config.frameSize || "100% 100%",
          position: config.framePosition || "center"
        } : null,
        config.texture ? {
          asset: config.texture,
          size: config.textureSize || "100% 100%",
          position: config.texturePosition || "center"
        } : null
      ]);
    }
    function createFrame(tagName, className, role, options) {
      const frame = createRegion(tagName, className, role);
      applyFrameArtwork(frame, options);
      return frame;
    }
    function appendImage(parent, className, assetLink, altText) {
      const normalized = sanitizeAssetLink(assetLink);
      if (!normalized.uiSrc) {
        return null;
      }
      const image = createElement("img", className || "");
      image.src = normalized.uiSrc;
      image.alt = altText || "";
      parent.append(image);
      return image;
    }
    function createTextChip(label, tone) {
      return createElement("span", "fk-chip" + (tone ? " fk-chip--" + tone : ""), label);
    }
    function createStatBadge(label, value, tone) {
      const item = createRegion(
        "div",
        "fk-stat-badge" + (tone ? " fk-stat-badge--" + tone : ""),
        null
      );
      item.append(createElement("span", "fk-stat-badge__label", label));
      item.append(createElement("strong", "fk-stat-badge__value", value));
      return item;
    }
    function createActionButton(label, variant, disabled, onClick) {
      const button = createRegion(
        "button",
        "fk-button fk-button--" + (variant || "secondary"),
        variant === "primary" ? "primary-action" : "secondary-action"
      );
      button.type = "button";
      button.disabled = disabled === true;
      button.append(createElement("span", "fk-button__label", label));
      applyFrameArtwork(button, {
        overlay: disabled === true ? getUiAsset("disabledPanel") : variant === "primary" ? getUiAsset("activeGlowPanel") : null,
        frame: getUiAsset("buttonPlate"),
        texture: variant === "primary" ? getUiAsset("primaryButton") : getUiAsset("secondaryButton")
      });
      button.addEventListener("click", function(event) {
        if (button.disabled !== true && typeof onClick === "function") {
          onClick(event);
        }
      });
      return button;
    }
    function createCatalogCard(entry, options) {
      const config = options || {};
      const button = createRegion(
        "button",
        "fk-card-choice fk-card-choice--" + (config.family || "generic"),
        config.role || null
      );
      button.type = "button";
      button.disabled = config.disabled === true;
      button.dataset.selected = config.selected === true ? "true" : "false";
      if (config.seatId) {
        button.dataset.seatId = config.seatId;
      }
      applyFrameArtwork(button, {
        overlay: button.disabled ? getUiAsset("cardDisabled") : config.selected ? getUiAsset("cardSelected") : getUiAsset("cardHoverGlow"),
        frame: getUiAsset("cardSlotFrame"),
        texture: config.template || getUiAsset("itemCardTemplate")
      });
      const art = createRegion("div", "fk-card-choice__art", null);
      appendImage(
        art,
        "fk-card-choice__image",
        entry.asset || entry,
        entry.label || entry.id || ""
      );
      button.append(art);
      const body = createRegion("div", "fk-card-choice__body", null);
      body.append(createElement("strong", "fk-card-choice__title", entry.label || entry.id || ""));
      (config.metaLines || []).forEach(function(line) {
        if (line && line.trim() !== "") {
          body.append(createElement("span", "fk-card-choice__meta", line));
        }
      });
      button.append(body);
      if (typeof config.onClick === "function") {
        button.addEventListener("click", function() {
          if (button.disabled !== true) {
            config.onClick(entry.id);
          }
        });
      }
      return button;
    }
    return {
      appendImage,
      applyAssetLayers,
      applyFrameArtwork,
      assetUrl,
      createActionButton,
      createCatalogCard,
      createFrame,
      createRegion,
      createStatBadge,
      createTextChip,
      setSeatId
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
