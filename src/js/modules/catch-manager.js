import { LogManager } from "./log-manager.js";
import { ServerCommands } from "./server-commands.js";

class CatchManagerClass {
  /**
   * Scans a list of messages for commands based on a given prefix.
   * @param {object} options
   * @param {string} options.provider - The provider of the messages (e.g., 'ai1', 'ai2').
   * @param {string} options.webUrl - The URL of the conversation.
   * @param {any[]} [options.messages=[]] - The list of message objects to scan.
   * @param {number} [options.prevCount=0] - The number of messages previously synced.
   * @param {boolean} [options.hasExisting=false] - Whether the conversation already exists in the archive.
   * @param {string} [options.prefix='cmd'] - The command prefix to look for (e.g., 'cmd', 'chat', 'bg').
   * @returns {Promise<any[]>} - A promise that resolves to an array of found and validated commands.
   */
  async catchCommands({
    provider,
    webUrl,
    messages = [],
    prevCount = 0,
    hasExisting = false,
    prefix = "cmd",
  }) {
    const list = Array.isArray(messages) ? messages : [];
    const startIndex = hasExisting
      ? Math.max(0, Math.min(prevCount, list.length))
      : 0;
    const targetMessages = list.filter(
      (msg) => msg?.role === "assistant" && (msg.index || 0) >= startIndex,
    );

    const found = [];

    targetMessages.forEach((msg) => {
      const text = msg.text || "";
      // Her mesaj için yeni regex oluştur - global flag ile lastIndex sorunu önlenir
      const regex = new RegExp(
        `\\+\\+${prefix}:([A-Za-z0-9_]+)\\(([^)]*)\\)`,
        "g",
      );
      let match;
      while ((match = regex.exec(text)) !== null) {
        const [, name, argsRaw] = match;
        found.push({
          provider,
          command: name,
          args: (argsRaw || "").trim(),
          prefix,
          text,
          webUrl,
        });
        LogManager.addEvent(
          `catch-${provider}`,
          "info",
          `Komut bulundu [${prefix}]: ${name}${argsRaw ? " | " + argsRaw : ""}`,
        );
      }
    });

    // Only validate against ServerCommands if the prefix is 'cmd'
    if (prefix === "cmd") {
      try {
        const valid = (ServerCommands.list() || []).map((s) =>
          String(s).toLowerCase(),
        );
        const filtered = found.filter((f) =>
          valid.includes(String(f.command || "").toLowerCase()),
        );
        if (found.length && !filtered.length) {
          LogManager.addEvent(
            `catch-${provider}`,
            "warning",
            `++cmd komutları bulundu fakat kayıtlı komut listesinde eşleşme yok (${found
              .map((f) => f.command)
              .join(", ")})`,
          );
        }
        return filtered;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        LogManager.addEvent(
          `catch-${provider}`,
          "warning",
          `ServerCommands kontrolü yapılamadı: ${message}`,
        );
        return found;
      }
    }

    return found;
  }
}

export const CatchManager = new CatchManagerClass();
