export function describeError(reason: unknown, fallback: string): string {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : reason && typeof reason === "object" && "message" in reason
          ? (reason as { message?: unknown }).message
          : undefined;
  return typeof message === "string" && message.trim() ? message : fallback;
}
