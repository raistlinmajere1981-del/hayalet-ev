// @ts-nocheck
// ServerCommands - diagramda tanımlı komutların örnek/dummy çalıştırıcıları
import { LogManager } from "./log-manager.js";
import { WhisperManager } from "./whisper-manager.js";
import { SettingsContext } from "./settings-context.js";
import { WebviewManager } from "./webview-manager.js";
import { ScreenshotManager } from "./screenshot-manager.js";
import { WindowManager } from "./window-manager.js";
import DeviceManager from "./device-manager.js";
import { AppState } from "./app-state.js";

const COMMAND_LIST = [
  "DeviceManager",
  "FileManager",
  "WebviewManager",
  "WhisperManager",
  "WindowManager",
  "ScreenshotManager",
  "TakeScreenshot",
  "PlayMusic",
  "Restart",
  "AIAIChatStart",
  "AIAIChatStop",
  "GetFile",
  "GetItDone",
  "ListFiles",
];

const handlers = {};

const defaultHandler =
  (name) =>
  async (payload = {}) => {
    const info = payload?.args ? ` | args: ${payload.args}` : "";
    LogManager.addEvent("server-command", "info", `${name} çalıştı${info}`);
    const stamp = new Date().toLocaleString("tr-TR");
    const settings = SettingsContext.get() || (await SettingsContext.init());
    const humanName = (settings?.human?.nickname || "").trim() || "user";
    const providerRaw = payload?.provider || "AI";
    const sender =
      payload?.sender ||
      (payload?.source === "manual"
        ? humanName
        : providerRaw === "ai1"
          ? settings?.ai1?.nickname || "AI1"
          : providerRaw === "ai2"
            ? settings?.ai2?.nickname || "AI2"
            : providerRaw);
    const argsLabel = payload?.args ? `(${payload.args})` : "()";
    const detail = payload?.detail || "Başarılı";
    LogManager.addEvent(
      "command-result",
      "success",
      `${sender} - ${name}${argsLabel} - ${stamp} - ${detail}`,
      {
        provider: providerRaw,
        sender,
        command: name,
        args: payload?.args || "",
        timestamp: stamp,
        detail,
      },
    );
    return { success: true, command: name, args: payload?.args, detail };
  };

const parseArgs = (rawArgs = "") => {
  const args = typeof rawArgs === "string" ? rawArgs : "";
  const parts = [];
  const regex = /"([^"]*)"|'([^']*)'|([^,\s]+)/g;
  let match;
  while ((match = regex.exec(args)) !== null) {
    const val = match[1] ?? match[2] ?? match[3] ?? "";
    if (val.trim()) {
      parts.push(val.trim());
    }
  }
  return parts;
};

const parseWhisperArgs = (rawArgs = "", fallbackProvider = "ai1") => {
  const parts = parseArgs(rawArgs);
  const [user, text, when] = parts;
  return { user: user || fallbackProvider, text: text || "", when: when || "" };
};

const parseScreenshotArgs = (rawArgs = "") => {
  const parts = parseArgs(rawArgs);
  const kind = (parts[0] || "system").toLowerCase();
  const selectorOrId = parts[1] || "";
  const format = parts[2] || "";
  return { kind, selectorOrId, format };
};

const parseWindowArgs = (rawArgs = "") => {
  const parts = parseArgs(rawArgs);
  const action = (parts[0] || "minimize").toLowerCase();
  return { action };
};

COMMAND_LIST.forEach((name) => {
  if (name === "WhisperManager") return;
  handlers[name.toLowerCase()] = defaultHandler(name);
});

handlers.whispermanager = async (payload = {}) => {
  const stamp = new Date().toLocaleString("tr-TR");
  const settings = SettingsContext.get() || (await SettingsContext.init());
  const humanName = (settings?.human?.nickname || "").trim() || "user";
  const providerRaw = payload?.provider || "AI";
  const provider =
    payload?.source === "manual"
      ? humanName
      : providerRaw === "ai1"
        ? settings?.ai1?.nickname || "AI1"
        : providerRaw === "ai2"
          ? settings?.ai2?.nickname || "AI2"
          : providerRaw;
  const { user, text, when } = parseWhisperArgs(payload?.args, provider);
  const argsLabel = payload?.args || `"${user}","${text}","${when}"`;

  try {
    const rec = WhisperManager.WhisperManagerAdd(user, text, when);
    LogManager.addEvent(
      "server-command",
      "info",
      `WhisperManager çalıştı | args: ${argsLabel}`,
    );
    LogManager.addEvent(
      "command-result",
      "success",
      `${provider} - WhisperManager(${argsLabel}) - ${stamp} - Başarılı`,
      {
        provider: providerRaw,
        sender: provider,
        command: "WhisperManager",
        args: argsLabel,
        timestamp: stamp,
        detail: "Başarılı",
      },
    );
    return {
      success: true,
      command: "WhisperManager",
      args: argsLabel,
      record: rec,
    };
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `WhisperManager hata: ${err?.message || err}`,
    );
    LogManager.addEvent(
      "command-result",
      "error",
      `${provider} - WhisperManager - ${stamp} - Hata: ${err?.message || err}`,
      {
        provider,
        command: "WhisperManager",
        args: argsLabel,
        timestamp: stamp,
        detail: err?.message || "WhisperManager hatası",
      },
    );
    return { success: false, message: err?.message || "WhisperManager hatası" };
  }
};

handlers.devicemanager = async (payload = {}) => {
  const stamp = new Date().toLocaleString("tr-TR");
  const providerRaw = payload?.provider || "AI";
  const provider = providerRaw;
  const parts = parseArgs(payload?.args || "");
  const action = (parts[0] || "").toLowerCase();
  const params = parts.slice(1);
  const argsLabel = payload?.args || "";
  try {
    LogManager.addEvent(
      "server-command",
      "info",
      `DeviceManager çağrıldı | action=${action} args=${params.join(",")}`,
    );
    let res = { success: false, message: "no-action" };
    if (action === "move" || action === "movemouse") {
      const x = Number(params[0] || 0);
      const y = Number(params[1] || 0);
      res = await DeviceManager.moveMouse(x, y);
    } else if (action === "click") {
      const btn = Number(params[0] || 1);
      res = await DeviceManager.click(btn);
    } else if (action === "mousedown") {
      const btn = Number(params[0] || 1);
      res = await DeviceManager.clickHold(btn);
    } else if (action === "mouseup") {
      const btn = Number(params[0] || 1);
      res = await DeviceManager.clickRelease(btn);
    } else if (action === "rightclick" || action === "rclick") {
      res =
        (await DeviceManager.rightClick?.()) || (await DeviceManager.click(3));
    } else if (action === "key") {
      const k = params[0] || "";
      res = await DeviceManager.key(k);
    } else if (action === "type" || action === "write") {
      const text = params.join(" ") || "";
      res = await DeviceManager.write(text);
    } else if (action === "copy") {
      const text = params.join(" ") || "";
      res = await DeviceManager.copy(text);
    } else if (action === "paste") {
      res = await DeviceManager.paste();
    } else {
      res = { success: false, message: "unknown-device-action" };
    }

    LogManager.addEvent(
      "command-result",
      res.success ? "success" : "error",
      `${provider} - DeviceManager(${argsLabel}) - ${stamp} - ${res?.message || (res.success ? "executed" : "failed")}`,
      {
        provider: providerRaw,
        sender: payload?.sender || provider,
        command: "DeviceManager",
        args: argsLabel,
        timestamp: stamp,
        detail: res?.message || "",
      },
    );
    return { success: !!res?.success, result: res };
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `DeviceManager hata: ${err?.message || err}`,
    );
    return { success: false, message: err?.message || "DeviceManager error" };
  }
};

handlers.screenshotmanager = async (payload = {}) => {
  const stamp = new Date().toLocaleString("tr-TR");
  const providerRaw = payload?.provider || "AI";
  const provider = providerRaw;
  const { kind, selectorOrId, format } = parseScreenshotArgs(
    payload?.args || "",
  );
  try {
    let saved = "";
    if (kind === "window") {
      saved = await ScreenshotManager.captureWindow(Number(selectorOrId) || 0, {
        tag: `window-${selectorOrId || "main"}`,
        format: format || undefined,
      });
    } else if (kind === "region") {
      saved = await ScreenshotManager.captureRegion(selectorOrId || "", {
        tag: `region`,
        format: format || undefined,
      });
    } else {
      saved = await ScreenshotManager.captureSystem(selectorOrId || "", {
        tag: `system`,
        format: format || undefined,
      });
    }

    const argsLabel = payload?.args || "";
    const sender = payload?.sender || provider;
    if (saved) {
      LogManager.addEvent(
        "server-command",
        "info",
        `ScreenshotManager çalıştı | kind: ${kind}`,
      );
      try {
        await WebviewManager.send({
          provider: providerRaw,
          text: `Ekran görüntüsü: ${kind}`,
          attachments: [
            { name: (saved || "").split(/[/\\]/).pop(), path: saved },
          ],
        });
        LogManager.addEvent(
          "server-command",
          "info",
          `ScreenshotManager gönderildi -> ${providerRaw} | ${saved}`,
        );
      } catch (err) {
        LogManager.addEvent(
          "server-command",
          "warning",
          `ScreenshotManager gönderilemedi: ${err?.message || err}`,
        );
      }
      LogManager.addEvent(
        "command-result",
        "success",
        `${provider} - ScreenshotManager("${kind}") - ${stamp} - Kaydedildi: ${saved}`,
        {
          provider: providerRaw,
          sender,
          command: "ScreenshotManager",
          args: argsLabel,
          timestamp: stamp,
          detail: saved,
        },
      );
      return {
        success: true,
        command: "ScreenshotManager",
        args: argsLabel,
        path: saved,
      };
    }

    LogManager.addEvent(
      "server-command",
      "warning",
      `ScreenshotManager çalıştı fakat sonuç boş | kind: ${kind}`,
    );
    return { success: false, message: "Screenshot alınamadı" };
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `ScreenshotManager hata: ${err?.message || err}`,
    );
    LogManager.addEvent(
      "command-result",
      "error",
      `${provider} - ScreenshotManager - ${stamp} - Hata: ${err?.message || err}`,
      {
        provider: providerRaw,
        command: "ScreenshotManager",
        args: payload?.args || "",
        timestamp: stamp,
        detail: err?.message || "Hata",
      },
    );
    return {
      success: false,
      message: err?.message || "ScreenshotManager hatası",
    };
  }
};

handlers.takescreenshot = handlers.screenshotmanager;

handlers.windowmanager = async (payload = {}) => {
  const stamp = new Date().toLocaleString("tr-TR");
  const providerRaw = payload?.provider || "AI";
  const provider = providerRaw;
  const { action } = parseWindowArgs(payload?.args || "");
  const displayAction = action.charAt(0).toUpperCase() + action.slice(1);
  const argsLabel = payload?.args || action;
  const sender = payload?.sender || provider;

  try {
    const result = WindowManager.apply(action);
    LogManager.addEvent(
      "server-command",
      "info",
      `WindowManager çalıştı | action: ${action}`,
    );
    LogManager.addEvent(
      "command-result",
      "success",
      `${provider} - WindowManager("${displayAction}") - ${stamp} - Executed`,
      {
        provider: providerRaw,
        sender,
        command: "WindowManager",
        args: argsLabel,
        timestamp: stamp,
        detail: `action: ${action}, success: ${result}`,
      },
    );
    return {
      success: !!result,
      command: "WindowManager",
      args: argsLabel,
      action,
      executed: result,
    };
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `WindowManager hata: ${err?.message || err}`,
    );
    LogManager.addEvent(
      "command-result",
      "error",
      `${provider} - WindowManager - ${stamp} - Hata: ${err?.message || err}`,
      {
        provider: providerRaw,
        command: "WindowManager",
        args: argsLabel,
        timestamp: stamp,
        detail: err?.message || "Hata",
      },
    );
    return { success: false, message: err?.message || "WindowManager hatası" };
  }
};

handlers.minimize = async (payload = {}) => {
  return handlers.windowmanager({ ...payload, args: "minimize" });
};

handlers.maximize = async (payload = {}) => {
  return handlers.windowmanager({ ...payload, args: "fullscreen" });
};

handlers.restore = async (payload = {}) => {
  return handlers.windowmanager({ ...payload, args: "restore" });
};

handlers.restart = async (payload = {}) => {
  const stamp = new Date().toLocaleString("tr-TR");
  const providerRaw = payload?.provider || "AI";
  const provider = providerRaw;
  const argsLabel = payload?.args || "";
  const sender = payload?.sender || provider;

  try {
    LogManager.addEvent("server-command", "info", `Restart başlatılıyor`);
    LogManager.addEvent(
      "command-result",
      "success",
      `${provider} - Restart() - ${stamp} - Başlatıldı`,
      {
        provider: providerRaw,
        sender,
        command: "Restart",
        args: argsLabel,
        timestamp: stamp,
        detail: "Uygulama yeniden başlatılıyor...",
      },
    );
    await window.electronAPI?.appRestart?.();
    return {
      success: true,
      command: "Restart",
      message: "Uygulama yeniden başlatılıyor...",
    };
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `Restart hata: ${err?.message || err}`,
    );
    LogManager.addEvent(
      "command-result",
      "error",
      `${provider} - Restart - ${stamp} - Hata: ${err?.message || err}`,
      {
        provider: providerRaw,
        command: "Restart",
        args: argsLabel,
        timestamp: stamp,
        detail: err?.message || "Hata",
      },
    );
    return { success: false, message: err?.message || "Restart hatası" };
  }
};

handlers.listfiles = async (payload = {}) => {
  const stamp = new Date().toLocaleString("tr-TR");
  const providerRaw = payload?.provider || "AI";
  const provider = providerRaw;
  const parts = parseArgs(payload?.args || "");
  const scope = (parts[0] || "project").toLowerCase();
  const argsLabel = payload?.args || scope;
  const sender = payload?.sender || provider;

  try {
    LogManager.addEvent(
      "server-command",
      "info",
      `ListFiles başlatılıyor | scope: ${scope}`,
    );

    const exclude =
      scope === "project" ? ["node_modules", "dist", ".vite"] : undefined;
    const treeResult = await window.electronAPI?.generateTree?.(
      scope === "project" ? "." : scope,
      {
        exclude,
      },
    );

    if (!treeResult?.success) {
      throw new Error(treeResult?.message || "Tree generation failed");
    }

    const { path: treePath, fileName, lines } = treeResult;

    try {
      await WebviewManager.send({
        provider: providerRaw,
        text: `Dosya Listesi (${scope}): ${lines} satır`,
        attachments: [
          {
            name: fileName,
            path: treePath,
          },
        ],
      });
      LogManager.addEvent(
        "server-command",
        "info",
        `ListFiles gönderildi -> ${providerRaw} | ${fileName}`,
      );
    } catch (err) {
      LogManager.addEvent(
        "server-command",
        "warning",
        `ListFiles gönderilemedi: ${err?.message || err}`,
      );
    }

    LogManager.addEvent(
      "command-result",
      "success",
      `${provider} - ListFiles("${scope}") - ${stamp} - Gönderildi`,
      {
        provider: providerRaw,
        sender,
        command: "ListFiles",
        args: argsLabel,
        timestamp: stamp,
        detail: `${lines} lines, ${fileName}`,
      },
    );

    return {
      success: true,
      command: "ListFiles",
      args: argsLabel,
      path: treePath,
      fileName,
      lines,
    };
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `ListFiles hata: ${err?.message || err}`,
    );
    LogManager.addEvent(
      "command-result",
      "error",
      `${provider} - ListFiles - ${stamp} - Hata: ${err?.message || err}`,
      {
        provider: providerRaw,
        command: "ListFiles",
        args: argsLabel,
        timestamp: stamp,
        detail: err?.message || "Hata",
      },
    );
    return { success: false, message: err?.message || "ListFiles hatası" };
  }
};

handlers.aiaichatstart = async (payload = {}) => {
  const { CoreEngine } = await import("./core-engine.js");
  const stamp = new Date().toLocaleString("tr-TR");
  const providerRaw = payload?.provider || "ai1";
  const provider =
    providerRaw === "ai1" || providerRaw === "ai2" ? providerRaw : "ai1"; // Default to ai1 if human/unknown
  const argsLabel = payload?.args || "";

  try {
    // 1. Check connections
    const ai1Conn = AppState.getConnection("ai1");
    const ai2Conn = AppState.getConnection("ai2");

    if (!ai1Conn || !ai2Conn) {
      throw new Error(
        "AI-AI sohbeti başlatılamadı: Her iki AI da bağlı olmalıdır.",
      );
    }

    // 2. Update UI Radio Button (Visual Sync)
    try {
      const radio = document.querySelector(
        `input[name="relay-starter"][value="${provider}"]`,
      );
      if (radio && !radio.disabled) {
        radio.checked = true;
      }
    } catch (e) {
      /* ignore DOM errors */
    }

    LogManager.addEvent(
      "server-command",
      "info",
      `AIAIChatStart başlatılıyor (${provider})`,
    );

    // 3. Start Protocol
    const result = await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "ai-ai",
      targets: ["ai1", "ai2"],
      mode: "aiRelaySequential",
      context: { starter: provider },
    });

    LogManager.addEvent(
      "command-result",
      result.success ? "success" : "error",
      `${providerRaw} - AIAIChatStart() - ${stamp} - ${result.success ? "Başlatıldı" : "Hata"}`,
      {
        provider: providerRaw,
        sender: payload?.sender || providerRaw,
        command: "AIAIChatStart",
        args: argsLabel,
        timestamp: stamp,
        detail: result.message || (result.success ? "Başlatıldı" : "Hata"),
      },
    );

    return result;
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `AIAIChatStart hata: ${err?.message || err}`,
    );
    return { success: false, message: err?.message || "AIAIChatStart hatası" };
  }
};

handlers.aiaichatstop = async (payload = {}) => {
  const { CoreEngine } = await import("./core-engine.js");
  const stamp = new Date().toLocaleString("tr-TR");
  const providerRaw = payload?.provider || "AI";

  try {
    LogManager.addEvent("server-command", "info", `AIAIChatStop isteniyor`);

    const result = await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "ai-ai-stop",
      targets: ["ai1", "ai2"],
    });

    LogManager.addEvent(
      "command-result",
      "success",
      `${providerRaw} - AIAIChatStop() - ${stamp} - Durduruldu`,
      {
        provider: providerRaw,
        sender: payload?.sender || providerRaw,
        command: "AIAIChatStop",
        args: "",
        timestamp: stamp,
        detail: "Durdurma sinyali gönderildi",
      },
    );

    return result;
  } catch (err) {
    LogManager.addEvent(
      "server-command",
      "error",
      `AIAIChatStop hata: ${err?.message || err}`,
    );
    return { success: false, message: err?.message || "AIAIChatStop hatası" };
  }
};

export const ServerCommands = {
  async run(commandName, payload = {}) {
    const key = (commandName || "").toLowerCase();
    const handler = handlers[key];
    if (handler) {
      return handler(payload);
    }
    LogManager.addEvent(
      "server-command",
      "warning",
      `Tanımsız komut: ${commandName}`,
    );
    return { success: false, message: "Tanımsız komut" };
  },
  list() {
    return [...COMMAND_LIST];
  },
};
