import { apiCall } from "./api.js";
import {
  normalizeConnectedProviderIds,
  normalizeModelItems,
  normalizeProviderItemsFromConfig,
  renderProviderRows,
  toReasoningEffortItems,
} from "./provider-catalog.js";
import type { CustomSelectAPI, RuntimeState } from "./types.js";

type ByIdFn = <T extends HTMLElement>(
  id: string,
  guard?: (element: T) => boolean
) => T | null;

export interface ProviderContext {
  runtime: RuntimeState;
  byId: ByIdFn;
  modelDropdown: CustomSelectAPI | null;
  effortDropdown: CustomSelectAPI | null;
}

export function refreshReasoningEffortDropdown(context: ProviderContext): void {
  if (context.effortDropdown == null) {
    return;
  }

  const items = toReasoningEffortItems(context.runtime.modelMetaById, context.runtime.activeModelId);
  if (items.length === 0) {
    context.runtime.activeReasoningEffort = null;
    context.effortDropdown.setError("Yok");
    return;
  }

  const selected =
    context.runtime.activeReasoningEffort != null &&
    items.some((item) => item.value === context.runtime.activeReasoningEffort)
      ? context.runtime.activeReasoningEffort
      : (items[1]?.value ?? items[0]?.value ?? null);

  context.runtime.activeReasoningEffort = selected;
  context.effortDropdown.setItems(items, selected ?? undefined);
}

export async function loadModels(
  context: ProviderContext,
  payloadOverride?: unknown
): Promise<void> {
  if (context.modelDropdown == null) {
    return;
  }

  try {
    const payload = payloadOverride ?? (await apiCall<unknown>("GET", "/config/providers"));
    const items = normalizeModelItems(payload);
    context.runtime.modelMetaById = {};
    items.forEach((item) => {
      context.runtime.modelMetaById[item.value] = {
        providerId: item.providerId ?? "",
        reasoningEfforts: item.reasoningEfforts ?? [],
      };
    });

    if (items.length === 0) {
      context.modelDropdown.setError("Yok");
      context.runtime.activeModelId = null;
      context.runtime.activeReasoningEffort = null;
      refreshReasoningEffortDropdown(context);

      const modelEl = context.byId<HTMLElement>("model");
      if (modelEl != null) {
        modelEl.textContent = "-";
      }
      return;
    }

    const defaultMap =
      payload != null && typeof payload === "object" && !Array.isArray(payload)
        ? ((payload as Record<string, unknown>)["default"] as Record<string, unknown> | undefined)
        : undefined;

    const defaults = defaultMap != null ? Object.values(defaultMap) : [];
    const defaultModelId = defaults.find((item): item is string => typeof item === "string") ?? "";

    const selected =
      context.runtime.activeModelId ??
      (defaultModelId !== "" ? defaultModelId : null) ??
      items[0]?.value ??
      null;

    context.runtime.activeModelId = selected;
    context.modelDropdown.setItems(items, selected ?? undefined);
    refreshReasoningEffortDropdown(context);

    const modelEl = context.byId<HTMLElement>("model");
    if (modelEl != null) {
      const selectedLabel = items.find((item) => item.value === selected)?.label ?? selected ?? "-";
      modelEl.textContent = selectedLabel;
    }
  } catch {
    context.modelDropdown.setError("Hata");
    context.runtime.activeModelId = null;
    context.runtime.activeReasoningEffort = null;
    context.runtime.modelMetaById = {};
    refreshReasoningEffortDropdown(context);
  }
}

function renderProvidersPanel(context: ProviderContext, markup: string): void {
  const listEl = context.byId<HTMLElement>("providers-list");
  if (listEl == null) {
    return;
  }

  listEl.innerHTML = markup;
}

export async function loadProviderContextAndModels(
  context: ProviderContext,
  providerPayloadOverride?: unknown,
  configPayloadOverride?: unknown
): Promise<void> {
  try {
    const providerPayload =
      providerPayloadOverride ?? (await apiCall<Record<string, unknown>>("GET", "/provider"));
    const configPayload =
      configPayloadOverride ?? (await apiCall<Record<string, unknown>>("GET", "/config/providers"));

    const connectedIds = normalizeConnectedProviderIds(providerPayload);
    const catalog = normalizeProviderItemsFromConfig(configPayload);
    const connectedSet = new Set(connectedIds);
    const items = catalog
      .map((item) => ({
        ...item,
        badge: connectedSet.has(item.id) ? "Connected" : "Available",
      }))
      .sort((left, right) => {
        if (left.badge !== right.badge) {
          return left.badge === "Connected" ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "tr");
      });

    renderProvidersPanel(context, renderProviderRows(items));
    await loadModels(context, configPayload);
  } catch {
    renderProvidersPanel(context, renderProviderRows([]));
    await loadModels(context, configPayloadOverride);
  }
}
