const MODE_INPUT_ALIASES = Object.freeze({
  "hayalet-ev": "app",
});

const MODE_OUTPUT_ALIASES = Object.freeze({
  app: "hayalet-ev",
});

export function normalizeModeInput(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const lower = trimmed.toLowerCase();
  return MODE_INPUT_ALIASES[lower] ?? lower;
}

export function formatModeOutput(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const lower = trimmed.toLowerCase();
  return MODE_OUTPUT_ALIASES[lower] ?? trimmed;
}
