/**
 * CDP Tools - TypeScript
 */

import type { ToolResult } from "@shared/index-mcp.js";

/**
 * CDP (Chrome DevTools Protocol) MCP Tools
 *
 * Electron uygulamasını uzaktan kontrol etmek için tool handler'lar.
 */

import { checkConnection, discoverTargets as _discoverTargets } from "../utils/cdp-connection.js";

import {
  clickBySelector,
  clickByText,
  fillInput,
  getPageStructure,
  checkElement,
  findElements,
  takeScreenshot,
  getWindowInfo,
  scrollTo,
  pressKey,
  executeScript,
} from "../utils/cdp-commands.js";

import { logToolError } from "../utils/mcp-logger.js";

/**
 * CDP hatalarını logla ve hata sonucu döndür
 */
function cdpError(toolName: string, error: Error, message?: string): ToolResult {
  logToolError(toolName, error, {});
  return {
    content: [{ type: "text", text: `❌ ${message ?? error.message}` }],
    isError: true,
  };
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

/**
 * Electron bağlantı durumunu kontrol et
 */
export async function checkElectronConnection(): Promise<ToolResult> {
  try {
    const status = await checkConnection();

    if (status.connected) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Electron bağlantısı aktif

📡 **Bağlantı Bilgileri:**
- Port: ${status.port}
- Hedef sayısı: ${status.targetsCount ?? 0}

🪟 **Ana Pencere:**
- Başlık: ${status.mainWindow?.title ?? "N/A"}
- URL: ${status.mainWindow?.url ?? "N/A"}
- Tip: ${status.mainWindow?.type ?? "N/A"}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `❌ Electron bağlantısı yok

**Hata:** ${status.error ?? "unknown"}

**Çözüm:**
1. Hayalet-ev uygulamasını başlatın: \`npm start\`
2. Uygulama otomatik olarak port ${status.port}'da debug modunda başlar
3. Tekrar deneyin`,
          },
        ],
      };
    }
  } catch (err) {
    return cdpError(
      "hev_check_electron_connection",
      err as Error,
      `Hata: ${(err as Error).message}`
    );
  }
}

/**
 * Electron'a komut gönder (JavaScript çalıştır)
 */
export async function sendCommandToElectron(
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  const { command, description } = args as { command?: string; description?: string };

  if (command == null || command === "") {
    return {
      content: [{ type: "text", text: "❌ 'command' parametresi gerekli" }],
      isError: true,
    };
  }

  try {
    const result = await executeScript(command);

    return {
      content: [
        {
          type: "text",
          text: `✅ Komut çalıştırıldı${isNonEmptyString(description) ? ` (${description})` : ""}

**Sonuç:**
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``,
        },
      ],
    };
  } catch (err) {
    return cdpError(
      "hev_send_command_to_electron",
      err as Error,
      `Komut hatası: ${(err as Error).message}`
    );
  }
}

export async function toggleMcpPanelServers(
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  const serversRaw = Array.isArray(args["servers"]) ? args["servers"] : [];
  const servers = serversRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== "");

  const providerRaw = args["provider"];
  const provider = providerRaw === "opencode" || providerRaw === "auto" ? providerRaw : "auto";

  const settleMsRaw = args["settleMs"];
  const settleMs =
    typeof settleMsRaw === "number" && Number.isFinite(settleMsRaw)
      ? Math.max(1000, Math.min(120000, Math.round(settleMsRaw)))
      : 4000;

  const cycleRaw = args["cycles"];
  const cycles =
    typeof cycleRaw === "number" && Number.isFinite(cycleRaw)
      ? Math.max(1, Math.min(5, Math.round(cycleRaw)))
      : 1;

  const targetServers = servers.length > 0 ? servers : ["context7", "grep_app", "hayalet-ev"];

  const payload = JSON.stringify({
    provider,
    settleMs,
    cycles,
    servers: targetServers,
  });

  const webviewScript = `(async () => {
    const options = ${payload};
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim().toLowerCase();
    const waitUntil = async (predicate, timeoutMs, pollMs) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (predicate() === true) {
          return true;
        }
        await wait(pollMs);
      }
      return false;
    };

    const detectProvider = () => {
      if (options.provider !== "auto") return options.provider;
      if (document.querySelector("button[role=tab]") !== null) {
        return "opencode";
      }
      return "unknown";
    };

    const openOpencodeMcpPanel = async () => {
      for (let i = 0; i < 8; i++) {
        const statusTrigger = document.querySelector("button[aria-haspopup=dialog]");
        if (statusTrigger !== null) {
          const expanded = statusTrigger.getAttribute("aria-expanded") === "true";
          if (!expanded) {
            statusTrigger.click();
          }
          await wait(250);
        }

        const tabs = Array.from(document.querySelectorAll("button[role=tab]"));
        const mcpTab = tabs.find((tab) => normalize(tab.textContent).includes("mcp"));
        if (mcpTab !== undefined) {
          mcpTab.click();
          await wait(300);
          return true;
        }

        await wait(300);
      }

      return false;
    };

    const findOpencodeSwitch = (name) => {
      const rows = Array.from(document.querySelectorAll("button"));

      const row = rows.find((button) => {
        const label = button.querySelector("span");
        if (normalize(label?.textContent) !== name) return false;
        return button.querySelector('input[type="checkbox"][role="switch"]') !== null;
      });

      if (!row) return null;
      return row.querySelector("input[type=checkbox][role=switch]");
    };

    const findRovodevSwitch = (name) => {
      const input = document.querySelector(
        '#mcp-list input[type=checkbox][data-mcp-name="' + name + '"]'
      );
      if (input !== null) return input;

      const rows = Array.from(document.querySelectorAll("#mcp-list .ds-item-row"));
      const row = rows.find((el) => normalize(el.textContent).includes(name));
      if (!row) return null;
      return row.querySelector("input[type=checkbox][data-mcp-name]");
    };

    const getSwitch = (name, mode) => {
      if (mode === "opencode") return findOpencodeSwitch(name);
      return findRovodevSwitch(name);
    };

    const captureStates = (mode) => {
      const out = {};
      for (const server of options.servers) {
        const input = getSwitch(server, mode);
        out[server] = input
          ? {
              checked: input.checked === true,
              ariaChecked: input.getAttribute("aria-checked"),
              id: input.id || null,
            }
          : null;
      }
      return out;
    };

    const mode = detectProvider();
    if (mode === "unknown") {
      return { ok: false, stage: "detect", reason: "mcp-panel-not-detected" };
    }

    if (mode === "opencode") {
      const opened = await openOpencodeMcpPanel();
      if (!opened) {
        return { ok: false, stage: "open-opencode-panel", reason: "mcp-tab-not-found" };
      }
    }

    const missing = options.servers.filter((name) => getSwitch(name, mode) === null);
    if (missing.length > 0) {
      return { ok: false, stage: "resolve-switches", reason: "servers-not-found", missing, mode };
    }

    const before = captureStates(mode);
    const actions = [];
    const stateTimeoutMs = Math.max(12000, options.settleMs * 6);
    const minOffMs = Math.max(5000, options.settleMs);

    for (let cycle = 0; cycle < options.cycles; cycle++) {
      for (const name of options.servers) {
        let input = getSwitch(name, mode);
        if (input === null) continue;

        const wasChecked = input.checked === true;
        let offConfirmed = false;
        let readyForOn = false;

        if (wasChecked) {
          input.click();
          offConfirmed = await waitUntil(() => {
            const current = getSwitch(name, mode);
            return current !== null && current.checked === false;
          }, stateTimeoutMs, 350);
        } else {
          offConfirmed = true;
        }

        await wait(minOffMs);

        readyForOn = await waitUntil(() => {
          const current = getSwitch(name, mode);
          return current !== null && current.disabled !== true;
        }, stateTimeoutMs, 400);

        const stateAfterOffInput = getSwitch(name, mode);
        const stateAfterOff = stateAfterOffInput?.checked === true;
        let onAttempts = 0;
        let onConfirmed = false;

        while (onAttempts < 8) {
          input = getSwitch(name, mode);
          if (input === null) break;
          if (input.checked === true) {
            onConfirmed = true;
            break;
          }

          if (input.disabled === true) {
            onAttempts += 1;
            await wait(Math.max(1000, Math.floor(options.settleMs / 2)));
            continue;
          }

          input.click();
          onAttempts += 1;
          const enabled = await waitUntil(() => {
            const current = getSwitch(name, mode);
            return current !== null && current.checked === true;
          }, Math.max(5000, options.settleMs * 2), 300);

          if (enabled) {
            onConfirmed = true;
            break;
          }

          await wait(Math.max(1000, Math.floor(options.settleMs / 3)));
        }

        const finalInput = getSwitch(name, mode);

        actions.push({
          cycle: cycle + 1,
          server: name,
          before: wasChecked,
          mid: stateAfterOff,
          offConfirmed,
          readyForOn,
          onAttempts,
          onConfirmed,
          after: finalInput?.checked === true,
        });
      }
    }

    return {
      ok: true,
      mode,
      settleMs: options.settleMs,
      cycles: options.cycles,
      before,
      actions,
      after: captureStates(mode),
    };
  })();`;

  const command = `(async () => {
    const ai0Webview = document.querySelector("#ai0-webview");
    if (!ai0Webview || typeof ai0Webview.executeJavaScript !== "function") {
      return { ok: false, stage: "bootstrap", reason: "ai0-webview-not-ready" };
    }
    return await ai0Webview.executeJavaScript(${JSON.stringify(webviewScript)});
  })();`;

  try {
    const commandTimeout = Math.min(
      240_000,
      60_000 +
        cycles *
          targetServers.length *
          (Math.max(5000, settleMs) + Math.max(1200, Math.floor(settleMs / 2)) * 8)
    );

    const result = await executeScript(command, commandTimeout);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError:
        typeof result === "object" && result !== null && (result as { ok?: boolean }).ok !== true,
    };
  } catch (err) {
    return cdpError(
      "hev_toggle_mcp_panel_servers",
      err as Error,
      `MCP panel toggle hatası: ${(err as Error).message}`
    );
  }
}

/**
 * Electron penceresinin ekran görüntüsünü al
 */
export async function takeCdpScreenshot(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    format = "png",
    quality = 80,
    savePath,
  } = args as { format?: string; quality?: number; savePath?: string };

  try {
    const base64Data = await takeScreenshot(format, quality);

    // Dosyaya kaydetme opsiyonu
    if (isNonEmptyString(savePath)) {
      const { writeFile } = await import("fs/promises");
      const buffer = Buffer.from(base64Data, "base64");
      await writeFile(savePath, buffer);

      return {
        content: [
          {
            type: "text",
            text: `✅ Screenshot kaydedildi: ${savePath}\n\nBoyut: ${buffer.length} bytes`,
          },
        ],
      };
    }

    // Base64 olarak döndür (küçük önizleme için)
    return {
      content: [
        {
          type: "text",
          text: `✅ Screenshot alındı (${format.toUpperCase()})

**Boyut:** ~${Math.round((base64Data.length * 0.75) / 1024)} KB

**Kullanım:** Dosyaya kaydetmek için \`savePath\` parametresi ekleyin.`,
        },
      ],
    };
  } catch (err) {
    return cdpError(
      "hev_take_cdp_screenshot",
      err as Error,
      `Screenshot hatası: ${(err as Error).message}`
    );
  }
}

/**
 * Electron pencere bilgilerini al
 */
export async function getElectronWindowInfo(): Promise<ToolResult> {
  try {
    const info = await getWindowInfo();

    return {
      content: [
        {
          type: "text",
          text: `🪟 **Electron Pencere Bilgileri:**

- **Başlık:** ${info.title}
- **URL:** ${info.url}
- **İç Boyut:** ${info.innerWidth} x ${info.innerHeight}
- **Dış Boyut:** ${info.outerWidth} x ${info.outerHeight}
- **Pixel Ratio:** ${info.devicePixelRatio}
- **Scroll Pozisyonu:** (${info.scrollX}, ${info.scrollY})`,
        },
      ],
    };
  } catch (err) {
    return cdpError(
      "hev_get_electron_window_info",
      err as Error,
      `Hata: ${(err as Error).message}`
    );
  }
}

/**
 * CSS selector ile elemente tıkla
 */
export async function clickElementBySelector(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector } = args as { selector?: string };

  if (!isNonEmptyString(selector)) {
    return {
      content: [{ type: "text", text: "❌ 'selector' parametresi gerekli" }],
      isError: true,
    };
  }

  try {
    const result = await clickBySelector(selector);

    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Tıklama başarılı

**Element:** <${result.tagName?.toLowerCase() ?? "unknown"}${isNonEmptyString(result.id) ? ` id="${result.id}"` : ""}${isNonEmptyString(result.className) ? ` class="${result.className}"` : ""}>`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ ${result.error ?? "unknown"}` }],
        isError: true,
      };
    }
  } catch (err) {
    return cdpError(
      "hev_click_element_by_selector",
      err as Error,
      `Tıklama hatası: ${(err as Error).message}`
    );
  }
}

/**
 * Metin içeriğine göre elemente tıkla
 */
export async function clickElementByText(args: Record<string, unknown>): Promise<ToolResult> {
  const { text, tagName = "*" } = args as { text?: string; tagName?: string };

  if (!isNonEmptyString(text)) {
    return {
      content: [{ type: "text", text: "❌ 'text' parametresi gerekli" }],
      isError: true,
    };
  }

  try {
    const result = await clickByText(text, tagName);

    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Tıklama başarılı

**Element:** <${result.tagName?.toLowerCase() ?? "unknown"}>
**İçerik:** "${result.textContent ?? ""}"`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ ${result.error ?? "unknown"}` }],
        isError: true,
      };
    }
  } catch (err) {
    return cdpError(
      "hev_click_element_by_text",
      err as Error,
      `Tıklama hatası: ${(err as Error).message}`
    );
  }
}

/**
 * Input alanına değer yaz
 */
export async function fillInputField(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    selector,
    value,
    clear = true,
  } = args as { selector?: string; value?: string; clear?: boolean };

  if (!isNonEmptyString(selector) || value === undefined) {
    return {
      content: [{ type: "text", text: "❌ 'selector' ve 'value' parametreleri gerekli" }],
      isError: true,
    };
  }

  try {
    const result = await fillInput(selector, value, clear);

    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Input dolduruldu

**Yeni değer:** "${result.newValue ?? ""}"`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ ${result.error ?? "unknown"}` }],
        isError: true,
      };
    }
  } catch (err) {
    return cdpError(
      "hev_fill_input_field",
      err as Error,
      `Input hatası: ${(err as Error).message}`
    );
  }
}

/**
 * Sayfa yapısını al (DOM tree)
 */
export async function getPageDomStructure(args: Record<string, unknown>): Promise<ToolResult> {
  const { maxDepth = 3 } = args as { maxDepth?: number };

  try {
    const structure = await getPageStructure(maxDepth);

    return {
      content: [
        {
          type: "text",
          text: `📄 **Sayfa Yapısı:**

**Başlık:** ${String(structure["title"])}
**URL:** ${String(structure["url"])}

**DOM Yapısı:**
\`\`\`json
${JSON.stringify(structure["body"], null, 2)}
\`\`\``,
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_get_page_dom_structure", err as Error, `Hata: ${(err as Error).message}`);
  }
}

/**
 * Element bul ve bilgilerini göster
 */
export async function inspectElement(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector } = args as { selector?: string };

  if (!isNonEmptyString(selector)) {
    return {
      content: [{ type: "text", text: "❌ 'selector' parametresi gerekli" }],
      isError: true,
    };
  }

  try {
    const info = await checkElement(selector);

    if (info.exists) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Element bulundu

**Selector:** \`${info.selector}\`
**Tag:** ${info.tagName ?? "unknown"}
**ID:** ${info.id ?? "(yok)"}
**Class:** ${info.className ?? "(yok)"}
**Görünür:** ${info.visible === true ? "Evet" : "Hayır"}
**Devre dışı:** ${info.disabled === true ? "Evet" : "Hayır"}
**Boyut:** ${info.bounds?.width ?? 0}x${info.bounds?.height ?? 0}
**Pozisyon:** (${Math.round(info.bounds?.x ?? 0)}, ${Math.round(info.bounds?.y ?? 0)})
**İçerik:** "${info.textContent ?? "(boş)"}"`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ Element bulunamadı: \`${selector}\`` }],
      };
    }
  } catch (err) {
    return cdpError("hev_inspect_element", err as Error, `Hata: ${(err as Error).message}`);
  }
}

/**
 * Birden fazla elementi bul
 */
export async function queryElements(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector, limit = 20 } = args as { selector?: string; limit?: number };

  if (!isNonEmptyString(selector)) {
    return {
      content: [{ type: "text", text: "❌ 'selector' parametresi gerekli" }],
      isError: true,
    };
  }

  try {
    const elements = await findElements(selector, limit);

    if (elements.length === 0) {
      return {
        content: [{ type: "text", text: `❌ Hiç element bulunamadı: \`${selector}\`` }],
      };
    }

    const list = elements
      .map(
        (el) =>
          `${el.index}. <${el.tagName.toLowerCase()}${isNonEmptyString(el.id) ? ` id="${el.id}"` : ""}> ${el.visible ? "👁" : "🚫"} "${el.textContent ?? ""}"`
      )
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `✅ ${elements.length} element bulundu

**Selector:** \`${selector}\`

${list}`,
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_query_elements", err as Error, `Hata: ${(err as Error).message}`);
  }
}

/**
 * Klavye tuşu gönder
 */
export async function sendKeyPress(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    key,
    ctrl = false,
    alt = false,
    shift = false,
    meta = false,
  } = args as { key?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean };

  if (!isNonEmptyString(key)) {
    return {
      content: [{ type: "text", text: "❌ 'key' parametresi gerekli" }],
      isError: true,
    };
  }

  try {
    const result = await pressKey(key, { ctrl, alt, shift, meta });

    const modifiers = [ctrl && "Ctrl", alt && "Alt", shift && "Shift", meta && "Meta"]
      .filter(Boolean)
      .join("+");

    return {
      content: [
        {
          type: "text",
          text: `✅ Tuş gönderildi: ${modifiers !== "" ? modifiers + "+" : ""}${key}

**Hedef element:** <${result.target?.toLowerCase() ?? "unknown"}>`,
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_send_key_press", err as Error, `Tuş hatası: ${(err as Error).message}`);
  }
}

/**
 * Sayfada scroll yap
 */
export async function scrollPage(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    x = 0,
    y = 0,
    behavior = "smooth",
  } = args as { x?: number; y?: number; behavior?: "smooth" | "instant" };

  try {
    const result = await scrollTo(x, y, behavior);

    return {
      content: [
        {
          type: "text",
          text: `✅ Scroll yapıldı

**Yeni pozisyon:** (${result.scrollX}, ${result.scrollY})`,
        },
      ],
    };
  } catch (err) {
    return cdpError("hev_scroll_page", err as Error, `Scroll hatası: ${(err as Error).message}`);
  }
}
