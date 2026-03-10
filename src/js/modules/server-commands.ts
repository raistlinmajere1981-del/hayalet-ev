import { LogCategory } from "@shared/logging-core";
import { Logger } from "./logger/index.js";
import { AppI18n } from "./i18n/index.js";
import { SettingsManager } from "./settings-manager.js";

import { createDefaultHandler } from "./commands/utils.js";
import type { CommandPayload } from "@shared/commands.js";

import { deviceManagerHandler } from "./commands/device-commands.js";
import { screenshotManagerHandler } from "./commands/screenshot-commands.js";
import {
  windowManagerHandler,
  minimizeHandler,
  maximizeHandler,
  restoreHandler,
  restartHandler,
} from "./commands/window-commands.js";
import { whisperManagerHandler } from "./commands/whisper-commands.js";
import { listFilesHandler } from "./commands/file-commands.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
async function getAiChatHandlers(): Promise<typeof import("./commands/ai-chat-commands.js")> {
  return await import("./commands/ai-chat-commands.js");
}
import { MetaCommandManager } from "./meta-command-manager.js";
import { RoomCommandRegistry } from "./rooms/room-command-registry.js";
import {
  getCommandDescription,
  getCommandDescriptionText,
} from "./commands/command-descriptions.js";
import type { CommandDescriptionInfo } from "./commands/command-descriptions.js";

type CommandCategory = "ai1-ai2" | "ai0";

interface CommandDefinition {
  name: string;
  category: CommandCategory;
  supportsTestMode?: boolean;
}

interface CommandCatalogItem {
  name: string;
  category: CommandCategory;
  isCustom: boolean;
  supportsTestMode: boolean;
}

const BUILTIN_COMMANDS: CommandDefinition[] = [
  { name: "DeviceManager", category: "ai1-ai2" },
  { name: "FileManager", category: "ai1-ai2" },
  { name: "WebviewManager", category: "ai1-ai2" },
  { name: "WhisperManager", category: "ai1-ai2" },
  { name: "WindowManager", category: "ai1-ai2" },
  { name: "ScreenshotManager", category: "ai1-ai2", supportsTestMode: true },
  { name: "TakeScreenshot", category: "ai1-ai2", supportsTestMode: true },
  { name: "PlayMusic", category: "ai1-ai2" },
  { name: "Restart", category: "ai1-ai2" },
  { name: "AIAIChatStart", category: "ai1-ai2" },
  { name: "AIAIChatStop", category: "ai1-ai2" },
  { name: "AIAssistantChatStart", category: "ai1-ai2" },
  { name: "AIAssistantChatStop", category: "ai1-ai2" },
  { name: "AIAssistantSend", category: "ai1-ai2", supportsTestMode: true },
  { name: "AssistantAISend", category: "ai0", supportsTestMode: true },
  { name: "GetFile", category: "ai1-ai2" },
  { name: "GetItDone", category: "ai1-ai2" },
  { name: "ListFiles", category: "ai1-ai2", supportsTestMode: true },
  { name: "DefineCommand", category: "ai1-ai2" },
  { name: "DeleteCommand", category: "ai1-ai2" },
  { name: "ListCustomCommands", category: "ai1-ai2" },
];

const COMMAND_LIST = BUILTIN_COMMANDS.map((command) => command.name);
const BUILTIN_BY_KEY = new Map(
  BUILTIN_COMMANDS.map((command) => [command.name.toLowerCase(), command])
);

function resolveCanonicalCommandName(commandName: string): string {
  return commandName.trim();
}

function normalizeProvider(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function resolveProviderCategory(provider: string): CommandCategory | null {
  if (provider === "ai0") {
    return "ai0";
  }
  if (provider === "ai1" || provider === "ai2") {
    return "ai1-ai2";
  }
  return null;
}

function getDisabledCommandsForProvider(provider: string): string[] {
  const snapshot = SettingsManager.getSnapshot();

  if (provider === "ai1" || provider === "ai2") {
    const disabled = snapshot.slots[provider].disabledCommands;
    return Array.isArray(disabled)
      ? disabled.filter((command): command is string => typeof command === "string")
      : [];
  }

  if (provider === "ai0") {
    const disabled = snapshot.assistantSlot?.disabledCommands;
    return Array.isArray(disabled)
      ? disabled.filter((command): command is string => typeof command === "string")
      : [];
  }

  return [];
}

function getCommandDefinition(commandName: string): CommandDefinition | null {
  const canonicalName = resolveCanonicalCommandName(commandName);
  const key = canonicalName !== "" ? canonicalName.toLowerCase() : "";
  const builtIn = BUILTIN_BY_KEY.get(key);
  if (builtIn !== undefined) {
    return builtIn;
  }

  if (MetaCommandManager.hasCommand(canonicalName)) {
    return {
      name: canonicalName,
      category: "ai1-ai2",
      supportsTestMode: false,
    };
  }

  const roomMetadata = RoomCommandRegistry.getMetadata(canonicalName);
  if (roomMetadata !== null) {
    return {
      name: roomMetadata.name,
      category: roomMetadata.category,
      supportsTestMode: false,
    };
  }

  return null;
}

function checkCommandAccess(
  commandName: string,
  payload: Record<string, unknown>
): {
  allowed: boolean;
  message: string;
} {
  const provider = normalizeProvider(payload["provider"]);
  const providerCategory = resolveProviderCategory(provider);
  const commandDefinition = getCommandDefinition(commandName);

  if (providerCategory !== null && commandDefinition !== null) {
    if (providerCategory === "ai0" && commandDefinition.category !== "ai0") {
      return {
        allowed: false,
        message: AppI18n.t("app.commands.access.assistantCannotUse"),
      };
    }

    if (providerCategory === "ai1-ai2" && commandDefinition.category === "ai0") {
      return {
        allowed: false,
        message: AppI18n.t("app.commands.access.assistantSlotOnly"),
      };
    }
  }

  if (provider !== "") {
    const disabledCommands = getDisabledCommandsForProvider(provider);
    const commandKey = resolveCanonicalCommandName(commandName).toLowerCase();
    const isDisabled = disabledCommands.some(
      (command) => resolveCanonicalCommandName(command).toLowerCase() === commandKey
    );

    if (isDisabled) {
      return {
        allowed: false,
        message: AppI18n.t("app.commands.access.disabledForSlot"),
      };
    }
  }

  return { allowed: true, message: "" };
}

const handlers: Record<string, (payload?: CommandPayload) => unknown> = {};

COMMAND_LIST.forEach((name) => {
  const key = name.toLowerCase();
  if (
    ![
      "whispermanager",
      "devicemanager",
      "screenshotmanager",
      "takescreenshot",
      "windowmanager",
      "minimize",
      "maximize",
      "restore",
      "restart",
      "listfiles",
      "aiaichatstart",
      "aiaichatstop",
      "aiassistantchatstart",
      "aiassistantchatstop",
      "aiassistantsend",
      "assistantaisend",
    ].includes(key)
  ) {
    handlers[key] = createDefaultHandler(name);
  }
});

handlers["devicemanager"] = deviceManagerHandler;
handlers["screenshotmanager"] = screenshotManagerHandler;
handlers["takescreenshot"] = screenshotManagerHandler;
handlers["windowmanager"] = windowManagerHandler;
handlers["minimize"] = minimizeHandler;
handlers["maximize"] = maximizeHandler;
handlers["restore"] = restoreHandler;
handlers["restart"] = restartHandler;
handlers["whispermanager"] = whisperManagerHandler;
handlers["listfiles"] = listFilesHandler;
handlers["aiaichatstart"] = async (payload): Promise<unknown> => {
  const { aiaiChatStartHandler } = await getAiChatHandlers();
  return await aiaiChatStartHandler(payload);
};
handlers["aiaichatstop"] = async (payload): Promise<unknown> => {
  const { aiaiChatStopHandler } = await getAiChatHandlers();
  return await aiaiChatStopHandler(payload);
};
handlers["aiassistantchatstart"] = async (payload): Promise<unknown> => {
  const { aiAssistantChatStartHandler } = await getAiChatHandlers();
  return await aiAssistantChatStartHandler(payload);
};
handlers["aiassistantchatstop"] = async (payload): Promise<unknown> => {
  const { aiAssistantChatStopHandler } = await getAiChatHandlers();
  return await aiAssistantChatStopHandler(payload);
};
handlers["aiassistantsend"] = async (payload): Promise<unknown> => {
  const { aiAssistantSendHandler } = await getAiChatHandlers();
  return await aiAssistantSendHandler(payload);
};
handlers["assistantaisend"] = async (payload): Promise<unknown> => {
  const { assistantAISendHandler } = await getAiChatHandlers();
  return await assistantAISendHandler(payload);
};

handlers["definecommand"] = async (payload?: CommandPayload): Promise<unknown> => {
  const args = typeof payload?.args === "string" ? payload.args : "";
  const match = args.match(/^([A-Za-z0-9_]+)\s*,\s*"([^"]*)"\s*,\s*`([\s\S]*)`$/);

  if (match === null) {
    return {
      success: false,
      error: AppI18n.t("app.commands.runtime.invalidDefineFormat"),
    };
  }

  const name = match[1];
  const description = match[2];
  const code = match[3];
  if (
    name === undefined ||
    name === "" ||
    description === undefined ||
    description === "" ||
    code === undefined ||
    code === ""
  ) {
    return { success: false, error: AppI18n.t("app.commands.runtime.invalidCommandData") };
  }
  const sender = payload?.sender !== undefined ? String(payload.sender) : "unknown";
  const result = await MetaCommandManager.defineCommand(name, description, code, sender);
  return result;
};

handlers["deletecommand"] = async (payload?: CommandPayload): Promise<unknown> => {
  const name = (typeof payload?.args === "string" ? payload.args : "").trim();
  if (name === "") {
    return { success: false, error: AppI18n.t("app.commands.runtime.commandNameRequired") };
  }
  const result = await MetaCommandManager.deleteCommand(name);
  return result;
};

handlers["listcustomcommands"] = (): {
  success: boolean;
  message: string;
  commands: Record<string, unknown>;
} => {
  const commands = MetaCommandManager.listCommands();
  const names = Object.keys(commands);
  return {
    success: true,
    message: AppI18n.t("app.commands.runtime.customCommandCount", { count: names.length }),
    commands,
  };
};

const serverCommands = {
  async run(commandName: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    const canonicalCommandName = resolveCanonicalCommandName(commandName);
    const key = canonicalCommandName !== "" ? canonicalCommandName.toLowerCase() : "";
    const handler = handlers[key];
    const scopeCheck = checkCommandAccess(canonicalCommandName, payload);

    if (scopeCheck.allowed !== true) {
      Logger.warn(
        LogCategory.SERVER_COMMANDS,
        AppI18n.t("app.commands.runtime.outOfScopeLog", { command: canonicalCommandName }),
        {
          category: "server-command",
          command: canonicalCommandName,
          provider: payload["provider"],
        }
      );
      return { success: false, message: scopeCheck.message };
    }

    if (handler !== undefined) {
      return handler(payload);
    }

    if (MetaCommandManager.hasCommand(canonicalCommandName)) {
      const argsStr = (payload as { args?: string }).args ?? "";
      const args =
        argsStr !== ""
          ? argsStr.split(",").map((s: string) => s.trim().replace(/^["']|["']$/g, ""))
          : [];
      return await MetaCommandManager.runCommand(canonicalCommandName, args);
    }

    if (RoomCommandRegistry.has(canonicalCommandName)) {
      return await RoomCommandRegistry.run(canonicalCommandName, payload);
    }

    Logger.warn(
      LogCategory.SERVER_COMMANDS,
      AppI18n.t("app.commands.runtime.undefinedCommandLog", { command: canonicalCommandName }),
      {
        category: "server-command",
      }
    );
    return { success: false, message: AppI18n.t("app.commands.runtime.undefinedCommand") };
  },

  list(): string[] {
    const customCmds = MetaCommandManager.getCommandNames();
    return Array.from(
      new Set([...COMMAND_LIST, ...customCmds, ...RoomCommandRegistry.listCommands()])
    );
  },

  listByCategory(category: CommandCategory): string[] {
    const builtIns = BUILTIN_COMMANDS.filter((command) => command.category === category).map(
      (command) => command.name
    );

    if (category !== "ai1-ai2") {
      return [...builtIns, ...RoomCommandRegistry.listCommands(category)];
    }

    const merged = new Set([
      ...builtIns,
      ...MetaCommandManager.getCommandNames(),
      ...RoomCommandRegistry.listCommands(category),
    ]);
    return Array.from(merged);
  },

  getCatalog(category?: CommandCategory): CommandCatalogItem[] {
    const builtIns = BUILTIN_COMMANDS.filter((command) =>
      category !== undefined ? command.category === category : true
    ).map((command) => ({
      name: command.name,
      category: command.category,
      isCustom: false,
      supportsTestMode: command.supportsTestMode === true,
    }));

    if (category !== undefined && category !== "ai1-ai2") {
      return builtIns;
    }

    const custom = MetaCommandManager.getCommandNames().map((name) => ({
      name,
      category: "ai1-ai2" as const,
      isCustom: true,
      supportsTestMode: false,
    }));

    return [...builtIns, ...custom, ...RoomCommandRegistry.getCatalog(category)];
  },

  getCommandMeta(commandName: string): CommandCatalogItem | undefined {
    const catalog = this.getCatalog();
    const key = resolveCanonicalCommandName(commandName).toLowerCase();
    return catalog.find((item) => item.name.toLowerCase() === key);
  },

  has(commandName: string): boolean {
    const canonicalCommandName = resolveCanonicalCommandName(commandName);
    const key = canonicalCommandName !== "" ? canonicalCommandName.toLowerCase() : "";
    return (
      handlers[key] !== undefined ||
      MetaCommandManager.hasCommand(canonicalCommandName) ||
      RoomCommandRegistry.has(canonicalCommandName)
    );
  },

  getDescription(commandName: string): CommandDescriptionInfo | undefined {
    return getCommandDescription(commandName);
  },

  getDescriptionText(commandName: string): string {
    const builtIn = getCommandDescriptionText(commandName);
    if (builtIn !== "") {
      return builtIn;
    }
    return RoomCommandRegistry.getDescriptionText(commandName);
  },

  register(commandName: string, handler: (payload?: unknown) => Promise<unknown>): void {
    if (typeof handler === "function") {
      handlers[commandName.toLowerCase()] = handler;
    }
  },
};

export { serverCommands, serverCommands as ServerCommands };
