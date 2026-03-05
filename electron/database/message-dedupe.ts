export function createMessageDedupeKey(
  domIndex: number | null | undefined,
  contentHash: string | null | undefined,
  domId?: string | null
): string {
  const normalizedDomId = (domId ?? "").trim();
  if (normalizedDomId !== "") {
    return `dom:${normalizedDomId}`;
  }

  const normalizedIndex = Number.isFinite(domIndex) ? Number(domIndex) : -1;
  const normalizedHash = (contentHash ?? "").trim();
  return `${normalizedIndex}:${normalizedHash}`;
}
