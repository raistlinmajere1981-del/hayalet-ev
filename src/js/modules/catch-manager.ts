import { Logger } from "./logger/index.js";
import { LogCategory } from "@shared/logging-core";

class CatchManagerClass {
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
        const argsSuffix = argsRaw !== undefined && argsRaw !== "" ? " | " + argsRaw : "";
        Logger.infoT(
          LogCategory.CATCH_MANAGER,
          "app.logs.catchManager.commandFound",
          {
            prefix,
            name,
            args: argsSuffix,
          },
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
