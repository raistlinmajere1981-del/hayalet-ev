(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiSurfacePrimitivesRuntime =
    function createFateKnotsUiSurfacePrimitivesRuntime(deps) {
      const createElement = deps.createElement;
      const sanitizeAssetLink = deps.sanitizeAssetLink;
      const getUiAsset = deps.getUiAsset;

      function normalizeRoleTokens(role) {
        if (!role) {
          return [];
        }
        const values = Array.isArray(role) ? role : [role];
        return values
          .map(function (value) {
            return typeof value === "string" ? value.trim() : "";
          })
          .filter(Boolean)
          .filter(function (value, index, list) {
            return list.indexOf(value) === index;
          });
      }

      function applyRoles(element, role) {
        const tokens = normalizeRoleTokens(role);
        if (tokens.length > 0) {
          element.dataset.fkRole = tokens.join(" ");
        }
        return element;
      }

      function createRegion(tagName, className, role) {
        const element = createElement(tagName, className || "");
        return applyRoles(element, role);
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

      function resolveMissingAssetId(assetLink, fallbackId) {
        const normalized = sanitizeAssetLink(assetLink);
        return (
          normalized.expectedAssetId ||
          normalized.assetId ||
          (normalized.asset && normalized.asset.id) ||
          fallbackId ||
          "unknown-asset"
        );
      }

      function markMissingAssets(element, missingAssetIds) {
        const ids = Array.isArray(missingAssetIds)
          ? missingAssetIds.filter(Boolean).filter(function (value, index, list) {
              return list.indexOf(value) === index;
            })
          : [];
        if (ids.length === 0) {
          return;
        }
        element.dataset.fkAssetStatus = "missing";
        element.dataset.fkMissingAssetIds = ids.join(" ");
        element.style.outline = "1px dashed rgb(196 114 86 / 0.72)";
        element.style.outlineOffset = "2px";
      }

      function applyAssetLayers(element, layers) {
        const missingAssetIds = [];
        const normalizedLayers = (Array.isArray(layers) ? layers : [])
          .map(function (layer, index) {
            if (!layer) {
              return null;
            }
            const assetLink = layer.asset || layer;
            const source = assetUrl(assetLink);
            if (!source) {
              missingAssetIds.push(resolveMissingAssetId(assetLink, "layer-" + String(index)));
              return null;
            }
            return {
              url: source,
              size: layer.size || "cover",
              position: layer.position || "center",
              repeat: layer.repeat || "no-repeat",
              blend: layer.blend || "normal",
            };
          })
          .filter(Boolean);

        if (missingAssetIds.length > 0) {
          markMissingAssets(element, missingAssetIds);
        }

        if (normalizedLayers.length === 0) {
          return;
        }

        element.style.backgroundImage = normalizedLayers
          .map(function (layer) {
            return 'url("' + layer.url + '")';
          })
          .join(", ");
        element.style.backgroundSize = normalizedLayers
          .map(function (layer) {
            return layer.size;
          })
          .join(", ");
        element.style.backgroundPosition = normalizedLayers
          .map(function (layer) {
            return layer.position;
          })
          .join(", ");
        element.style.backgroundRepeat = normalizedLayers
          .map(function (layer) {
            return layer.repeat;
          })
          .join(", ");
        element.style.backgroundBlendMode = normalizedLayers
          .map(function (layer) {
            return layer.blend;
          })
          .join(", ");
      }

      function applyFrameArtwork(element, options) {
        const config = options || {};
        applyAssetLayers(element, [
          config.overlay
            ? {
                asset: config.overlay,
                size: config.overlaySize || "cover",
                position: config.overlayPosition || "center",
                blend: config.overlayBlend || "screen",
              }
            : null,
          config.frame
            ? {
                asset: config.frame,
                size: config.frameSize || "100% 100%",
                position: config.framePosition || "center",
              }
            : null,
          config.texture
            ? {
                asset: config.texture,
                size: config.textureSize || "100% 100%",
                position: config.texturePosition || "center",
              }
            : null,
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
          const fallback = createRegion(
            "div",
            (className || "") + " fk-missing-asset fk-missing-asset--image",
            null
          );
          const missingAssetId = resolveMissingAssetId(normalized, altText || "missing-asset");
          markMissingAssets(fallback, [missingAssetId]);
          fallback.append(
            createElement(
              "span",
              "fk-missing-asset__label",
              "Missing asset: " + (altText || missingAssetId)
            )
          );
          parent.append(fallback);
          return fallback;
        }
        const image = createElement("img", className || "");
        image.src = normalized.uiSrc;
        image.alt = altText || "";
        image.dataset.fkAssetStatus = "ready";
        image.dataset.fkAssetId = normalized.assetId || normalized.asset.id || "";
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
          overlay:
            disabled === true
              ? getUiAsset("disabledPanel")
              : variant === "primary"
                ? getUiAsset("activeGlowPanel")
                : null,
          frame: getUiAsset("buttonPlate"),
          texture:
            variant === "primary" ? getUiAsset("primaryButton") : getUiAsset("secondaryButton"),
        });
        button.addEventListener("click", function (event) {
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
          overlay: button.disabled
            ? getUiAsset("cardDisabled")
            : config.selected
              ? getUiAsset("cardSelected")
              : getUiAsset("cardHoverGlow"),
          frame: getUiAsset("cardSlotFrame"),
          texture: config.template || getUiAsset("itemCardTemplate"),
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
        (config.metaLines || []).forEach(function (line) {
          if (line && line.trim() !== "") {
            body.append(createElement("span", "fk-card-choice__meta", line));
          }
        });
        button.append(body);
        if (typeof config.onClick === "function") {
          button.addEventListener("click", function () {
            if (button.disabled !== true) {
              config.onClick(entry.id);
            }
          });
        }
        return button;
      }

      return {
        appendImage: appendImage,
        applyAssetLayers: applyAssetLayers,
        applyFrameArtwork: applyFrameArtwork,
        assetUrl: assetUrl,
        createActionButton: createActionButton,
        createCatalogCard: createCatalogCard,
        createFrame: createFrame,
        createRegion: createRegion,
        createStatBadge: createStatBadge,
        createTextChip: createTextChip,
        setSeatId: setSeatId,
      };
    };
})(typeof window !== "undefined" ? window : globalThis);
