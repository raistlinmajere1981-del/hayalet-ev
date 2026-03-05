import { Logger } from "./logger/index.js";
import { LogCategory } from "@shared/logging-core";

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
  catchCommands({
    provider,
    webUrl,
    messages = [],
    prevCount = 0,
    hasExisting = false,
    prefix = "cmd",
  }: {
    provider: string;
    webUrl: string;
    messages?: Array<{ role?: string; text?: string; index?: number }>;
    prevCount?: number;
    hasExisting?: boolean;
    prefix?: string;
  }): Array<{
    provider: string;
    command: string;
    args: string;
    prefix: string;
    text: string;
    webUrl: string;
  }> {
    const list = Array.isArray(messages) ? messages : [];
    const startIndex = hasExisting ? Math.max(0, Math.min(prevCount, list.length)) : 0;
    const assistantMessages = list.filter(
      (msg) => msg.role === "assistant" && (msg.index ?? 0) >= startIndex
    );
    const targetMessages =
      assistantMessages.length > 0
        ? [assistantMessages[assistantMessages.length - 1] as (typeof assistantMessages)[number]]
        : [];

    const found: Array<{
      provider: string;
      command: string;
      args: string;
      prefix: string;
      text: string;
      webUrl: string;
    }> = [];

    targetMessages.forEach((msg) => {
      const text = msg.text ?? "";
      const regex = new RegExp(`\\+\\+${prefix}:([A-Za-z0-9_]+)\\(([^)]*)\\)`, "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        const name = match[1];
        const argsRaw = match[2];
        if (name === undefined || name === "") continue;
        found.push({
          provider,
          command: name,
          args: (argsRaw ?? "").trim(),
          prefix,
          text,
          webUrl,
        });
        Logger.info(
          LogCategory.CATCH_MANAGER,
          `Komut bulundu [${prefix}]: ${name}${argsRaw !== undefined && argsRaw !== "" ? " | " + argsRaw : ""}`,
          {
            category: `catch-${provider}`,
          }
        );
      }
    });

    return found;
  }
}

const catchManager = new CatchManagerClass();

export { catchManager, catchManager as CatchManager };
