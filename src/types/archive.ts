export const ARCHIVE_PROVIDER_KEYS = ["ai1", "ai2", "us1"] as const;

export type ArchiveProviderKey = (typeof ARCHIVE_PROVIDER_KEYS)[number];

export function isArchiveProviderKey(value: unknown): value is ArchiveProviderKey {
  return typeof value === "string" && (ARCHIVE_PROVIDER_KEYS as readonly string[]).includes(value);
}

export const US1_PROJECTED_ACCOUNT_PREFIX = "us1_projected_";
const US1_SYNTHETIC_URI_PREFIX = "mail://remote-user/";

function encodeUs1Token(value: string): string {
  return encodeURIComponent(value.trim());
}

function decodeUs1Token(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildUs1ProjectedAccountId(remoteUserId: string): string {
  const normalizedRemoteUserId = encodeUs1Token(remoteUserId);
  if (normalizedRemoteUserId === "") {
    return "";
  }

  return `${US1_PROJECTED_ACCOUNT_PREFIX}${normalizedRemoteUserId}`;
}

export function isUs1ProjectedAccountId(
  accountId: unknown
): accountId is `${typeof US1_PROJECTED_ACCOUNT_PREFIX}${string}` {
  return typeof accountId === "string" && accountId.startsWith(US1_PROJECTED_ACCOUNT_PREFIX);
}

export function extractUs1RemoteUserIdFromAccountId(accountId: string): string | null {
  if (!isUs1ProjectedAccountId(accountId)) {
    return null;
  }

  const encodedRemoteUserId = accountId.slice(US1_PROJECTED_ACCOUNT_PREFIX.length);
  if (encodedRemoteUserId === "") {
    return null;
  }

  return decodeUs1Token(encodedRemoteUserId);
}

export function buildUs1SyntheticSessionUri(remoteUserId: string, localSessionId: string): string {
  const normalizedRemoteUserId = encodeUs1Token(remoteUserId);
  const normalizedLocalSessionId = encodeUs1Token(localSessionId);

  if (normalizedRemoteUserId === "" || normalizedLocalSessionId === "") {
    return "";
  }

  return `${US1_SYNTHETIC_URI_PREFIX}${normalizedRemoteUserId}/session/${normalizedLocalSessionId}`;
}

export function isUs1SyntheticSessionUri(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(US1_SYNTHETIC_URI_PREFIX);
}
