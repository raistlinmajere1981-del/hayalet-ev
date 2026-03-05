function toRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function toAccountIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = toRecord(item);
      if (record === null) {
        return "";
      }
      const id = record["id"];
      return typeof id === "string" ? id.trim() : "";
    })
    .filter((id) => id !== "");
}

export function collectSearchAccountIds(settings: unknown): string[] {
  const record = toRecord(settings);
  if (record === null) {
    return [];
  }

  const ids = new Set<string>();

  toAccountIds(record["accounts"]).forEach((id) => {
    ids.add(id);
  });

  const slots = toRecord(record["slots"]);
  if (slots !== null) {
    ["ai1", "ai2"].forEach((slot) => {
      const slotState = toRecord(slots[slot]);
      const accountId = slotState?.["accountId"];
      if (typeof accountId === "string" && accountId !== "") {
        ids.add(accountId);
      }
    });
  }

  return Array.from(ids);
}
