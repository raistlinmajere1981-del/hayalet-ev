import { escapeHtml } from "./chat-utils.js";
import type { ByIdFn } from "./host-helpers.js";
import type { OpencodeUiModelPreferences, RuntimeState, SelectItem } from "./types.js";

interface ModelSettingsOverlayOptions {
  runtime: RuntimeState;
  byId: ByIdFn;
  showToast: (message: string) => void;
  updateModelPreferences: (
    updater:
      | OpencodeUiModelPreferences
      | ((current: OpencodeUiModelPreferences) => OpencodeUiModelPreferences)
  ) => Promise<void>;
}

interface OverlayUiState {
  searchQuery: string;
  favoritesOnly: boolean;
  showHidden: boolean;
}

function renderSummary(runtime: RuntimeState): string {
  const hiddenProviderCount = runtime.modelPreferences.hiddenProviders.length;
  const hiddenModelCount = runtime.modelItems.filter((item) => item.isHidden === true).length;
  const favoriteCount = runtime.modelPreferences.favoriteModels.length;
  const defaultMeta =
    runtime.modelPreferences.defaultModelKey != null
      ? runtime.modelMetaByKey[runtime.modelPreferences.defaultModelKey]
      : undefined;
  const defaultLabel = defaultMeta?.label ?? "Endpoint fallback";

  return (
    `<span class="model-settings__chip">Default: ${escapeHtml(defaultLabel)}</span>` +
    `<span class="model-settings__chip">Favori: ${String(favoriteCount)}</span>` +
    `<span class="model-settings__chip">Gizli Provider: ${String(hiddenProviderCount)}</span>` +
    `<span class="model-settings__chip">Gizli Model: ${String(hiddenModelCount)}</span>`
  );
}

function renderProviderRows(runtime: RuntimeState): string {
  if (runtime.providerItems.length === 0) {
    return '<div class="empty-state">Provider bulunamadi</div>';
  }

  return runtime.providerItems
    .map((provider) => {
      const hidden = provider.isHidden === true;
      const statusLabel = provider.isConnected === true ? "Connected" : "Available";
      const countLabel =
        typeof provider.visibleModels === "number" && typeof provider.totalModels === "number"
          ? `${String(provider.visibleModels)}/${String(provider.totalModels)}`
          : "0/0";

      return (
        `<div class="model-settings__provider-row">` +
        `<div class="model-settings__provider-meta">` +
        `<div class="model-settings__provider-name">${escapeHtml(provider.name)}</div>` +
        `<div class="model-settings__provider-subtitle">${escapeHtml(statusLabel)} • ${escapeHtml(
          countLabel
        )}</div>` +
        `</div>` +
        `<button type="button" class="model-settings__toggle-btn" data-provider-toggle="${escapeHtml(
          provider.id
        )}" aria-pressed="${hidden ? "true" : "false"}">${hidden ? "Gizli" : "Gorunur"}</button>` +
        `</div>`
      );
    })
    .join("");
}

function filterModelItems(runtime: RuntimeState, ui: OverlayUiState): SelectItem[] {
  const query = ui.searchQuery.trim().toLocaleLowerCase("tr");

  return runtime.modelItems.filter((item) => {
    const label =
      `${item.label} ${item.subtitle ?? ""} ${item.providerName ?? item.providerId ?? ""}`
        .trim()
        .toLocaleLowerCase("tr");
    if (query !== "" && !label.includes(query)) {
      return false;
    }
    if (ui.favoritesOnly && item.isFavorite !== true) {
      return false;
    }
    if (!ui.showHidden && item.isHidden === true) {
      return false;
    }
    return true;
  });
}

function renderModelRows(runtime: RuntimeState, ui: OverlayUiState): string {
  const items = filterModelItems(runtime, ui);
  if (items.length === 0) {
    return '<div class="empty-state">Filtreye uygun model yok</div>';
  }

  const grouped = new Map<string, SelectItem[]>();
  items.forEach((item) => {
    const providerName = item.providerName ?? item.providerId ?? "Bilinmeyen";
    const existing = grouped.get(providerName) ?? [];
    existing.push(item);
    grouped.set(providerName, existing);
  });

  return Array.from(grouped.entries())
    .map(([providerName, providerItems]) => {
      const rows = providerItems
        .map((item) => {
          const modelKey = item.modelKey ?? item.value;
          const isDefault = runtime.modelPreferences.defaultModelKey === modelKey;
          const isFavorite = item.isFavorite === true;
          const isHidden = item.isHidden === true;
          const isActive = runtime.activeModelKey === modelKey;
          const badges = [
            isActive
              ? '<span class="model-settings__badge model-settings__badge--active">Secili</span>'
              : "",
            isDefault
              ? '<span class="model-settings__badge model-settings__badge--default">Default</span>'
              : "",
            item.isConnected === true
              ? '<span class="model-settings__badge">Connected</span>'
              : '<span class="model-settings__badge">Available</span>',
          ]
            .filter((item) => item !== "")
            .join("");

          return (
            `<div class="model-settings__model-row${isHidden ? " is-hidden" : ""}">` +
            `<div class="model-settings__model-main">` +
            `<div class="model-settings__model-title">${escapeHtml(item.label)}</div>` +
            `<div class="model-settings__model-subtitle">${escapeHtml(item.subtitle ?? modelKey)}</div>` +
            `<div class="model-settings__badge-row">${badges}</div>` +
            `</div>` +
            `<div class="model-settings__model-actions">` +
            `<button type="button" class="model-settings__icon-btn${
              isFavorite ? " is-active" : ""
            }" data-model-favorite="${escapeHtml(modelKey)}" title="Favori">${
              isFavorite ? "★" : "☆"
            }</button>` +
            `<button type="button" class="model-settings__action-btn" data-model-default="${escapeHtml(
              modelKey
            )}">${isDefault ? "Varsayilan" : "Default yap"}</button>` +
            `<button type="button" class="model-settings__action-btn" data-model-toggle="${escapeHtml(
              modelKey
            )}">${isHidden ? "Goster" : "Gizle"}</button>` +
            `</div>` +
            `</div>`
          );
        })
        .join("");

      return (
        `<section class="model-settings__group">` +
        `<div class="model-settings__group-title">${escapeHtml(providerName)}</div>` +
        rows +
        `</section>`
      );
    })
    .join("");
}

export function createModelSettingsOverlayController(options: ModelSettingsOverlayOptions): {
  init: () => void;
  refresh: () => void;
} {
  const ui: OverlayUiState = {
    searchQuery: "",
    favoritesOnly: false,
    showHidden: false,
  };

  const open = (): void => {
    const modal = options.byId<HTMLElement>("model-settings-modal");
    if (modal == null) {
      return;
    }
    modal.classList.add("is-active");
    refresh();
  };

  const close = (): void => {
    const modal = options.byId<HTMLElement>("model-settings-modal");
    modal?.classList.remove("is-active");
  };

  const refresh = (): void => {
    const summary = options.byId<HTMLElement>("model-settings-summary");
    if (summary != null) {
      summary.innerHTML = renderSummary(options.runtime);
    }

    const providerList = options.byId<HTMLElement>("model-settings-provider-list");
    if (providerList != null) {
      providerList.innerHTML = renderProviderRows(options.runtime);
    }

    const modelList = options.byId<HTMLElement>("model-settings-model-list");
    if (modelList != null) {
      modelList.innerHTML = renderModelRows(options.runtime, ui);
    }

    const searchInput = options.byId<HTMLInputElement>("model-settings-search");
    if (searchInput != null && searchInput.value !== ui.searchQuery) {
      searchInput.value = ui.searchQuery;
    }

    const favoritesOnly = options.byId<HTMLInputElement>("model-settings-favorites-only");
    if (favoritesOnly != null) {
      favoritesOnly.checked = ui.favoritesOnly;
    }

    const showHidden = options.byId<HTMLInputElement>("model-settings-show-hidden");
    if (showHidden != null) {
      showHidden.checked = ui.showHidden;
    }
  };

  const toggleProviderVisibility = async (providerId: string): Promise<void> => {
    await options.updateModelPreferences((current) => {
      const hiddenProviders = new Set(current.hiddenProviders);
      if (hiddenProviders.has(providerId)) {
        hiddenProviders.delete(providerId);
      } else {
        hiddenProviders.add(providerId);
      }

      return {
        ...current,
        hiddenProviders: Array.from(hiddenProviders).sort(),
      };
    });
    refresh();
  };

  const toggleModelFavorite = async (modelKey: string): Promise<void> => {
    await options.updateModelPreferences((current) => {
      const favorites = new Set(current.favoriteModels);
      if (favorites.has(modelKey)) {
        favorites.delete(modelKey);
      } else {
        favorites.add(modelKey);
      }

      return {
        ...current,
        favoriteModels: Array.from(favorites).sort(),
      };
    });
    refresh();
  };

  const toggleModelVisibility = async (modelKey: string): Promise<void> => {
    await options.updateModelPreferences((current) => {
      const hiddenModels = new Set(current.hiddenModels);
      if (hiddenModels.has(modelKey)) {
        hiddenModels.delete(modelKey);
      } else {
        hiddenModels.add(modelKey);
      }

      return {
        ...current,
        hiddenModels: Array.from(hiddenModels).sort(),
      };
    });
    refresh();
  };

  const setDefaultModel = async (modelKey: string): Promise<void> => {
    const meta = options.runtime.modelMetaByKey[modelKey];
    if (meta == null) {
      options.showToast("Model bilgisi bulunamadi");
      return;
    }

    await options.updateModelPreferences((current) => ({
      ...current,
      hiddenProviders: current.hiddenProviders.filter((item) => item !== meta.providerId),
      hiddenModels: current.hiddenModels.filter((item) => item !== modelKey),
      defaultModelKey: modelKey,
    }));
    options.showToast("Varsayilan model guncellendi");
    refresh();
  };

  const bindActionHandlers = (): void => {
    options.byId<HTMLButtonElement>("model-settings-btn")?.addEventListener("click", open);
    options.byId<HTMLButtonElement>("model-settings-close")?.addEventListener("click", close);
    options.byId<HTMLElement>("model-settings-backdrop")?.addEventListener("click", close);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
      }
    });

    options.byId<HTMLInputElement>("model-settings-search")?.addEventListener("input", (event) => {
      ui.searchQuery = (event.target as HTMLInputElement).value;
      refresh();
    });

    options
      .byId<HTMLInputElement>("model-settings-favorites-only")
      ?.addEventListener("change", (event) => {
        ui.favoritesOnly = (event.target as HTMLInputElement).checked;
        refresh();
      });

    options
      .byId<HTMLInputElement>("model-settings-show-hidden")
      ?.addEventListener("change", (event) => {
        ui.showHidden = (event.target as HTMLInputElement).checked;
        refresh();
      });

    options
      .byId<HTMLElement>("model-settings-provider-list")
      ?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const providerId =
          target.closest<HTMLElement>("[data-provider-toggle]")?.dataset["providerToggle"];
        if (providerId != null && providerId !== "") {
          void toggleProviderVisibility(providerId);
        }
      });

    options.byId<HTMLElement>("model-settings-model-list")?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;

      const favoriteKey =
        target.closest<HTMLElement>("[data-model-favorite]")?.dataset["modelFavorite"];
      if (favoriteKey != null && favoriteKey !== "") {
        void toggleModelFavorite(favoriteKey);
        return;
      }

      const toggleKey = target.closest<HTMLElement>("[data-model-toggle]")?.dataset["modelToggle"];
      if (toggleKey != null && toggleKey !== "") {
        void toggleModelVisibility(toggleKey);
        return;
      }

      const defaultKey =
        target.closest<HTMLElement>("[data-model-default]")?.dataset["modelDefault"];
      if (defaultKey != null && defaultKey !== "") {
        void setDefaultModel(defaultKey);
      }
    });
  };

  return {
    init(): void {
      bindActionHandlers();
      refresh();
    },
    refresh,
  };
}
