(function (global: any) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiSurfacePrimitivesRuntime =
    function createFateKnotsUiSurfacePrimitivesRuntime(deps: any) {
      const createElement = deps.createElement;
      const sanitizeAssetLink = deps.sanitizeAssetLink;
      const getUiAsset = deps.getUiAsset;

      function normalizeRoleTokens(role: string | string[] | null | undefined): string[] {
        if (!role) {
          return [];
        }
        const values = Array.isArray(role) ? role : [role];
        return values
          .map(function (value: string) {
            return typeof value === "string" ? value.trim() : "";
          })
          .filter(Boolean)
          .filter(function (value: string, index: number, list: string[]) {
            return list.indexOf(value) === index;
          });
      }

      function applyRoles(
        element: HTMLElement,
        role: string | string[] | null | undefined
      ): HTMLElement {
        const tokens = normalizeRoleTokens(role);
        if (tokens.length > 0) {
          element.dataset["fkRole"] = tokens.join(" ");
        }
        return element;
      }

      function createRegion(
        tagName: string,
        className: string,
        role: string | string[] | null | undefined
      ): HTMLElement {
        const element = createElement(tagName, className || "");
        return applyRoles(element, role);
      }

      function setSeatId(element: HTMLElement, seatId: string): HTMLElement {
        if (element && seatId) {
          element.dataset["seatId"] = seatId;
        }
        return element;
      }

      function assetUrl(assetLink: any): string {
        const normalized = sanitizeAssetLink(assetLink);
        return normalized.uiSrc || normalized.src || "";
      }

      function resolveMissingAssetId(assetLink: any, fallbackId: string): string {
        const normalized = sanitizeAssetLink(assetLink);
        return (
          normalized.expectedAssetId ||
          normalized.assetId ||
          (normalized.asset && normalized.asset.id) ||
          fallbackId ||
          "unknown-asset"
        );
      }

      function markMissingAssets(element: HTMLElement, missingAssetIds: string[]): void {
        const ids = Array.isArray(missingAssetIds)
          ? missingAssetIds.filter(Boolean).filter(function (
              value: string,
              index: number,
              list: string[]
            ) {
              return list.indexOf(value) === index;
            })
          : [];
        if (ids.length === 0) {
          return;
        }
        element.dataset["fkAssetStatus"] = "missing";
        element.dataset["fkMissingAssetIds"] = ids.join(" ");
        element.style.outline = "1px dashed rgb(196 114 86 / 0.72)";
        element.style.outlineOffset = "2px";
      }

      function applyAssetLayers(element: HTMLElement, layers: any[]): void {
        const missingAssetIds: string[] = [];
        const normalizedLayers = (Array.isArray(layers) ? layers : [])
          .map(function (layer: any, index: number) {
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

        type StyledAssetLayer = {
          url: string;
          size: string;
          position: string;
          repeat: string;
          blend: string;
        };
        const styledLayers = normalizedLayers as StyledAssetLayer[];

        element.style.backgroundImage = styledLayers
          .map(function (layer: any) {
            return 'url("' + layer.url + '")';
          })
          .join(", ");
        element.style.backgroundSize = styledLayers
          .map(function (layer: any) {
            return layer.size;
          })
          .join(", ");
        element.style.backgroundPosition = styledLayers
          .map(function (layer: any) {
            return layer.position;
          })
          .join(", ");
        element.style.backgroundRepeat = styledLayers
          .map(function (layer: any) {
            return layer.repeat;
          })
          .join(", ");
        element.style.backgroundBlendMode = styledLayers
          .map(function (layer: any) {
            return layer.blend;
          })
          .join(", ");
      }

      function applyFrameArtwork(element: HTMLElement, options: any): void {
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

      function createFrame(
        tagName: string,
        className: string,
        role: string | string[] | null | undefined,
        options: any
      ): HTMLElement {
        const frame = createRegion(tagName, className, role);
        applyFrameArtwork(frame, options);
        return frame;
      }

      function appendImage(
        parent: HTMLElement,
        className: string,
        assetLink: any,
        altText: string
      ): HTMLElement {
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

      function createTextChip(label: string, tone: string): HTMLElement {
        return createElement("span", "fk-chip" + (tone ? " fk-chip--" + tone : ""), label);
      }

      function createStatBadge(label: string, value: string, tone: string): HTMLElement {
        const item = createRegion(
          "div",
          "fk-stat-badge" + (tone ? " fk-stat-badge--" + tone : ""),
          null
        );
        item.append(createElement("span", "fk-stat-badge__label", label));
        item.append(createElement("strong", "fk-stat-badge__value", value));
        return item;
      }

      function createActionButton(
        label: string,
        variant: string,
        disabled: boolean,
        onClick: (event: Event) => void
      ): HTMLButtonElement {
        const button = createRegion(
          "button",
          "fk-button fk-button--" + (variant || "secondary"),
          variant === "primary" ? "primary-action" : "secondary-action"
        ) as HTMLButtonElement;
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
        button.addEventListener("click", function (event: Event) {
          if (button.disabled !== true && typeof onClick === "function") {
            onClick(event);
          }
        });
        return button;
      }

      function createCatalogCard(entry: any, options: any): HTMLButtonElement {
        const config = options || {};
        const button = createRegion(
          "button",
          "fk-card-choice fk-card-choice--" + (config.family || "generic"),
          config.role || null
        ) as HTMLButtonElement;
        button.type = "button";
        button.disabled = config.disabled === true;
        button.dataset["selected"] = config.selected === true ? "true" : "false";
        if (config.seatId) {
          button.dataset["seatId"] = config.seatId;
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
        body.append(
          createElement("strong", "fk-card-choice__title", entry.label || entry.id || "")
        );
        (config.metaLines || []).forEach(function (line: string) {
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
