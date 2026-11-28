export function acquireGaiaStorageLock(
  canonicalPath: string,
  owner?: boolean
): Promise<() => Promise<void>>;
