import { escapeHtml } from "./chat-utils.js";
import type { ModelMeta, ProviderItem, SelectItem } from "./types.js";
import { normalizeString } from "./message-content.js";

const REASONING_EFFORT_ORDER = ["low", "medium", "high", "xhigh"];

function normalizeReasoningEfforts(raw: unknown): string[] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  const values = Object.keys(raw)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => REASONING_EFFORT_ORDER.includes(item));

  if (values.length === 0) {
    return [];
  }

  const unique = Array.from(new Set(values));
  return REASONING_EFFORT_ORDER.filter((item) => unique.includes(item));
}

function extractModelMeta(modelRecord: Record<string, unknown>, providerId: string): ModelMeta {
  const variants = modelRecord["variants"];
  const reasoningEfforts = normalizeReasoningEfforts(variants);
  return {
    providerId,
    reasoningEfforts,
  };
}

export function toReasoningEffortItems(
  modelMetaById: Record<string, ModelMeta>,
  modelId: string | null
): SelectItem[] {
  if (modelId == null || modelId === "") {
    return [];
  }

  const meta = modelMetaById[modelId];
  if (meta == null) {
    return [];
  }

  return meta.reasoningEfforts.map((effort) => ({
    value: effort,
    label: `effort:${effort}`,
    subtitle: modelId,
  }));
}

export function normalizeAgentItems(data: unknown): SelectItem[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (typeof item === "string") {
        return { value: item, label: item };
      }

      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const idValue = normalizeString(record["id"]);
        const nameValue = normalizeString(record["name"]);
        const value = idValue !== "" ? idValue : nameValue;
        if (value === "") return null;
        return {
          value,
          label: nameValue !== "" ? nameValue : value,
          subtitle: normalizeString(record["description"]),
        };
      }

      return null;
    })
    .filter((item): item is SelectItem => item != null && item.value !== "");
}

export function normalizeModelItems(payload: unknown): SelectItem[] {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const providers = Array.isArray(record["providers"]) ? record["providers"] : [];
  const items: SelectItem[] = [];

  providers.forEach((provider) => {
    if (provider == null || typeof provider !== "object" || Array.isArray(provider)) {
      return;
    }

    const providerRecord = provider as Record<string, unknown>;
    const providerId = normalizeString(providerRecord["id"]);
    const modelsRaw = providerRecord["models"];
    const models = Array.isArray(modelsRaw)
      ? modelsRaw
      : modelsRaw != null && typeof modelsRaw === "object"
        ? Object.values(modelsRaw as Record<string, unknown>)
        : [];

    models.forEach((model) => {
      if (typeof model === "string") {
        const label = providerId !== "" ? `${providerId}:${model}` : model;
        items.push({ value: model, label, providerId, reasoningEfforts: [] });
        return;
      }

      if (model != null && typeof model === "object" && !Array.isArray(model)) {
        const modelRecord = model as Record<string, unknown>;
        const directModelId = normalizeString(modelRecord["id"]);
        const legacyModelId = normalizeString(modelRecord["model"]);
        const altModelId = normalizeString(modelRecord["modelID"]);
        const modelId =
          directModelId !== "" ? directModelId : legacyModelId !== "" ? legacyModelId : altModelId;
        if (modelId === "") {
          return;
        }

        const rawModelName = normalizeString(modelRecord["name"]);
        const modelName = rawModelName !== "" ? rawModelName : modelId;
        const label = providerId !== "" ? `${providerId}:${modelName}` : modelName;
        const modelMeta = extractModelMeta(modelRecord, providerId);
        items.push({
          value: modelId,
          label,
          subtitle: modelId,
          providerId: modelMeta.providerId,
          reasoningEfforts: modelMeta.reasoningEfforts,
        });
      }
    });
  });

  const deduped = new Map<string, SelectItem>();
  items.forEach((item) => {
    if (!deduped.has(item.value)) {
      deduped.set(item.value, item);
    }
  });

  return Array.from(deduped.values());
}

export function normalizeProviderItemsFromConfig(payload: unknown): ProviderItem[] {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const providersRaw = (payload as Record<string, unknown>)["providers"];
  if (!Array.isArray(providersRaw)) {
    return [];
  }

  const deduped = new Map<string, ProviderItem>();

  providersRaw.forEach((provider) => {
    if (provider == null || typeof provider !== "object" || Array.isArray(provider)) {
      return;
    }

    const record = provider as Record<string, unknown>;
    const id = normalizeString(record["id"]);
    if (id === "") {
      return;
    }

    const name = normalizeString(record["name"]);
    const type = normalizeString(record["type"]);
    const badge = type !== "" ? type : "Config";

    deduped.set(id, {
      id,
      name: name !== "" ? name : id,
      badge,
    });
  });

  return Array.from(deduped.values());
}

export function normalizeConnectedProviderIds(payload: unknown): string[] {
  const collectStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((item) => {
            if (typeof item === "string") {
              return item.trim();
            }

            if (item != null && typeof item === "object" && !Array.isArray(item)) {
              const record = item as Record<string, unknown>;
              const id = normalizeString(record["id"]);
              const name = normalizeString(record["name"]);
              return id !== "" ? id : name;
            }

            return "";
          })
          .filter((item) => item !== "")
      : [];

  if (Array.isArray(payload)) {
    return Array.from(new Set(collectStringArray(payload)));
  }

  if (payload == null || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const connected = collectStringArray(record["connected"]);
  if (connected.length > 0) {
    return Array.from(new Set(connected));
  }

  const providers = record["providers"];
  if (Array.isArray(providers)) {
    const activeIds = providers
      .map((item) => {
        if (item == null || typeof item !== "object" || Array.isArray(item)) {
          return "";
        }

        const providerRecord = item as Record<string, unknown>;
        const connectedValue = providerRecord["connected"];
        const activeValue = providerRecord["active"];
        if (connectedValue === true || activeValue === true) {
          const id = normalizeString(providerRecord["id"]);
          const name = normalizeString(providerRecord["name"]);
          return id !== "" ? id : name;
        }

        return "";
      })
      .filter((item) => item !== "");

    if (activeIds.length > 0) {
      return Array.from(new Set(activeIds));
    }
  }

  return [];
}

export function renderProviderRows(items: ProviderItem[]): string {
  if (items.length === 0) {
    return '<div class="empty-state">Provider bulunamadi</div>';
  }

  return items
    .map((item) => {
      const safeName = escapeHtml(item.name);
      const safeBadge = escapeHtml(item.badge);

      return (
        `<div class="ds-provider-row">` +
        `<span class="ds-provider-name">${safeName}</span>` +
        (safeBadge !== "" ? `<span class="ds-provider-badge">${safeBadge}</span>` : "") +
        `</div>`
      );
    })
    .join("");
}
