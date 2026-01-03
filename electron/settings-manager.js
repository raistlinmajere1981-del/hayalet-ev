import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const settingsPath = join(process.cwd(), "settings.json");

export async function loadSettings() {
  try {
    const readDefaults = () => ({
      human: { nickname: "Kullanıcı", avatarPath: "" },
      ai1: {
        providerId: "chatgpt",
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
        activeAccountId: null,
      },
      ai2: {
        providerId: "grok",
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
        activeAccountId: null,
      },
      general: {
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
      accounts: [],
    });

    const migrateLegacy = (data) => {
      if (!data) return readDefaults();
      const payload = { ...data };

      // If legacy keys exist move them to ai1/ai2
      if (!payload.ai1 && data.chatgpt) payload.ai1 = data.chatgpt;
      if (!payload.ai2 && data.grok) payload.ai2 = data.grok;

      // Clean up legacy keys
      delete payload.chatgpt;
      delete payload.grok;

      // Ensure defaults for missing keys
      const defaults = readDefaults();
      if (!payload.ai1) payload.ai1 = { ...defaults.ai1 };
      if (!payload.ai2) payload.ai2 = { ...defaults.ai2 };
      if (!payload.human) payload.human = { ...defaults.human };
      if (!payload.general) payload.general = { ...defaults.general };

      // Add activeAccountId if missing in ai1/ai2
      if (payload.ai1 && typeof payload.ai1.activeAccountId === "undefined") {
        payload.ai1.activeAccountId = null;
      }
      if (payload.ai2 && typeof payload.ai2.activeAccountId === "undefined") {
        payload.ai2.activeAccountId = null;
      }

      // Initialize accounts array if missing
      if (!Array.isArray(payload.accounts)) {
        payload.accounts = [];

        // Auto-migrate existing ai1/ai2 configs to accounts
        // Only migrate if there's a providerId but no activeAccountId
        if (payload.ai1?.providerId && !payload.ai1.activeAccountId) {
          const ai1Nickname = "AI1 Account";
          const ai1Avatar = "";
          payload.accounts.push({
            id: generateAccountId("ai1", payload.ai1.providerId),
            email: `ai1@${payload.ai1.providerId}.local`,
            provider: payload.ai1.providerId,
            nickname: ai1Nickname,
            avatarPath: ai1Avatar,
          });
          payload.ai1.activeAccountId = payload.accounts[0].id;
        }
        if (payload.ai2?.providerId && !payload.ai2.activeAccountId) {
          const ai2Nickname = "AI2 Account";
          const ai2Avatar = "";
          payload.accounts.push({
            id: generateAccountId("ai2", payload.ai2.providerId),
            email: `ai2@${payload.ai2.providerId}.local`,
            provider: payload.ai2.providerId,
            nickname: ai2Nickname,
            avatarPath: ai2Avatar,
          });
          payload.ai2.activeAccountId = payload.accounts[payload.accounts.length - 1]?.id;
        }
      }

      return payload;
    };

    function generateAccountId(slot, provider) {
      const sanitizedSlot = slot.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const sanitizedProvider = provider
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
      return `acc-${sanitizedSlot}-${sanitizedProvider}-${Date.now().toString(36)}`;
    }

    if (existsSync(settingsPath)) {
      const data = await readFile(settingsPath, "utf-8");
      return migrateLegacy(JSON.parse(data));
    }
    return readDefaults();
  } catch (error) {
    console.error("Error loading settings:", error);
    return null;
  }
}

export async function saveSettings(eventOrSettings, maybeSettings) {
  try {
    const settings =
      typeof maybeSettings === "undefined" ? eventOrSettings : maybeSettings;

    const baseDir = process.cwd();
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true });
    }
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}
