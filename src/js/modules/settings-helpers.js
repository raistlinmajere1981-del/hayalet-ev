/**
 * Settings Helper Functions
 * Provides centralized access to slot-based settings with account resolution
 */

/**
 * Get slot information (nickname, avatarPath, provider) from active account
 * @param {Object} settings - The settings object
 * @param {string} slot - The slot name ('ai1' or 'ai2')
 * @returns {Object} Slot info object with nickname, avatarPath, and provider
 */
export function getSlotInfo(settings, slot) {
  if (!settings || (slot !== "ai1" && slot !== "ai2")) {
    return {
      nickname: slot === "ai1" ? "AI1" : "AI2",
      avatarPath: "",
      provider: "",
    };
  }

  const activeAccountId = settings[slot]?.activeAccountId;

  // If no account is assigned to this slot, return defaults
  if (!activeAccountId) {
    return {
      nickname: slot === "ai1" ? "AI1" : "AI2",
      avatarPath: "",
      provider: settings[slot]?.providerId || "",
    };
  }

  // Find the account by ID
  const account = settings.accounts?.find((acc) => acc.id === activeAccountId);

  // If account not found, return defaults
  if (!account) {
    return {
      nickname: slot === "ai1" ? "AI1" : "AI2",
      avatarPath: "",
      provider: settings[slot]?.providerId || "",
    };
  }

  // Return account-based info
  return {
    nickname: account.nickname || account.email,
    avatarPath: account.avatarPath || "",
    provider: account.provider,
  };
}

/**
 * Get nickname for a specific provider/slot
 * @param {Object} settings - The settings object
 * @param {string} provider - The provider/slot name ('human', 'ai1', 'ai2')
 * @returns {string} The nickname
 */
export function getNickname(settings, provider) {
  if (!settings) return provider === "human" ? "User" : provider.toUpperCase();

  if (provider === "human") {
    return settings.human?.nickname || "User";
  }

  if (provider === "ai1" || provider === "ai2") {
    const slotInfo = getSlotInfo(settings, provider);
    return slotInfo.nickname;
  }

  return provider.toUpperCase();
}

/**
 * Get avatar path for a specific provider/slot
 * @param {Object} settings - The settings object
 * @param {string} provider - The provider/slot name ('human', 'ai1', 'ai2')
 * @returns {string} The avatar path
 */
export function getAvatarPath(settings, provider) {
  if (!settings) return "";

  if (provider === "human") {
    return settings.human?.avatarPath || "";
  }

  if (provider === "ai1" || provider === "ai2") {
    const slotInfo = getSlotInfo(settings, provider);
    return slotInfo.avatarPath;
  }

  return "";
}

/**
 * Get provider ID for a specific slot
 * @param {Object} settings - The settings object
 * @param {string} slot - The slot name ('ai1' or 'ai2')
 * @returns {string} The provider ID
 */
export function getProviderId(settings, slot) {
  if (!settings || (slot !== "ai1" && slot !== "ai2")) {
    return "";
  }

  const slotInfo = getSlotInfo(settings, slot);
  return slotInfo.provider || settings[slot]?.providerId || "";
}
