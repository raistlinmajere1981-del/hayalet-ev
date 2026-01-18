/**
 * CDP Tools - TypeScript
 */

import type { ToolResult } from "../types/index.js";

/**
 * CDP (Chrome DevTools Protocol) MCP Tools
 * 
 * Electron uygulamasını uzaktan kontrol etmek için tool handler'lar.
 */

import {
  checkConnection,
  discoverTargets as _discoverTargets,
} from "../utils/cdp-connection.js";

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

/**
 * Electron bağlantı durumunu kontrol et
 */
export async function checkElectronConnection(): Promise<ToolResult> {
  try {
    const status = await checkConnection();
    
    if (status.connected) {
      return {
        content: [{
          type: "text",
          text: `✅ Electron bağlantısı aktif

📡 **Bağlantı Bilgileri:**
- Port: ${status.port}
- Hedef sayısı: ${status.targetsCount}

🪟 **Ana Pencere:**
- Başlık: ${status.mainWindow?.title || "N/A"}
- URL: ${status.mainWindow?.url || "N/A"}
- Tip: ${status.mainWindow?.type || "N/A"}`,
        }],
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `❌ Electron bağlantısı yok

**Hata:** ${status.error}

**Çözüm:**
1. Hayalet-ev uygulamasını başlatın: \`npm start\`
2. Uygulama otomatik olarak port ${status.port}'da debug modunda başlar
3. Tekrar deneyin`,
        }],
      };
    }
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Electron'a komut gönder (JavaScript çalıştır)
 */
export async function sendCommandToElectron(args: Record<string, unknown> = {}): Promise<ToolResult> {
  const { command, description } = args as { command?: string; description?: string };
  
  if (!command) {
    return {
      content: [{ type: "text", text: "❌ 'command' parametresi gerekli" }],
      isError: true,
    };
  }
  
  try {
    const result = await executeScript(command);
    
    return {
      content: [{
        type: "text",
        text: `✅ Komut çalıştırıldı${description ? ` (${description})` : ""}

**Sonuç:**
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``,
      }],
    };
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Komut hatası: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Electron penceresinin ekran görüntüsünü al
 */
export async function takeCdpScreenshot(args: Record<string, unknown>): Promise<ToolResult> {
  const { format = "png", quality = 80, savePath } = args as { format?: string; quality?: number; savePath?: string };
  
  try {
    const base64Data = await takeScreenshot(format, quality);
    
    // Dosyaya kaydetme opsiyonu
    if (savePath) {
      const { writeFile } = await import("fs/promises");
      const buffer = Buffer.from(base64Data, "base64");
      await writeFile(savePath, buffer);
      
      return {
        content: [{
          type: "text",
          text: `✅ Screenshot kaydedildi: ${savePath}\n\nBoyut: ${buffer.length} bytes`,
        }],
      };
    }
    
    // Base64 olarak döndür (küçük önizleme için)
    return {
      content: [{
        type: "text",
        text: `✅ Screenshot alındı (${format.toUpperCase()})

**Boyut:** ~${Math.round(base64Data.length * 0.75 / 1024)} KB

**Kullanım:** Dosyaya kaydetmek için \`savePath\` parametresi ekleyin.`,
      }],
    };
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Screenshot hatası: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Electron pencere bilgilerini al
 */
export async function getElectronWindowInfo(): Promise<ToolResult> {
  try {
    const info = await getWindowInfo();
    
    return {
      content: [{
        type: "text",
        text: `🪟 **Electron Pencere Bilgileri:**

- **Başlık:** ${info.title}
- **URL:** ${info.url}
- **İç Boyut:** ${info.innerWidth} x ${info.innerHeight}
- **Dış Boyut:** ${info.outerWidth} x ${info.outerHeight}
- **Pixel Ratio:** ${info.devicePixelRatio}
- **Scroll Pozisyonu:** (${info.scrollX}, ${info.scrollY})`,
      }],
    };
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * CSS selector ile elemente tıkla
 */
export async function clickElementBySelector(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector } = args as { selector?: string };
  
  if (!selector) {
    return {
      content: [{ type: "text", text: "❌ 'selector' parametresi gerekli" }],
      isError: true,
    };
  }
  
  try {
    const result = await clickBySelector(selector);
    
    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `✅ Tıklama başarılı

**Element:** <${result.tagName?.toLowerCase() ?? "unknown"}${result.id ? ` id="${result.id}"` : ""}${result.className ? ` class="${result.className}"` : ""}>`,
        }],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ ${result.error}` }],
        isError: true,
      };
    }
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Tıklama hatası: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Metin içeriğine göre elemente tıkla
 */
export async function clickElementByText(args: Record<string, unknown>): Promise<ToolResult> {
  const { text, tagName = "*" } = args as { text?: string; tagName?: string };
  
  if (!text) {
    return {
      content: [{ type: "text", text: "❌ 'text' parametresi gerekli" }],
      isError: true,
    };
  }
  
  try {
    const result = await clickByText(text, tagName);
    
    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `✅ Tıklama başarılı

**Element:** <${result.tagName?.toLowerCase() ?? "unknown"}>
**İçerik:** "${result.textContent}"`,
        }],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ ${result.error}` }],
        isError: true,
      };
    }
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Tıklama hatası: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Input alanına değer yaz
 */
export async function fillInputField(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector, value, clear = true } = args as { selector?: string; value?: string; clear?: boolean };
  
  if (!selector || value === undefined) {
    return {
      content: [{ type: "text", text: "❌ 'selector' ve 'value' parametreleri gerekli" }],
      isError: true,
    };
  }
  
  try {
    const result = await fillInput(selector, value, clear);
    
    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `✅ Input dolduruldu

**Yeni değer:** "${result.newValue}"`,
        }],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ ${result.error}` }],
        isError: true,
      };
    }
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Input hatası: ${error.message}` }],
      isError: true,
    };
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
      content: [{
        type: "text",
        text: `📄 **Sayfa Yapısı:**

**Başlık:** ${structure.title}
**URL:** ${structure.url}

**DOM Yapısı:**
\`\`\`json
${JSON.stringify(structure.body, null, 2)}
\`\`\``,
      }],
    };
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Element bul ve bilgilerini göster
 */
export async function inspectElement(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector } = args as { selector?: string };
  
  if (!selector) {
    return {
      content: [{ type: "text", text: "❌ 'selector' parametresi gerekli" }],
      isError: true,
    };
  }
  
  try {
    const info = await checkElement(selector);
    
    if (info.exists) {
      return {
        content: [{
          type: "text",
          text: `✅ Element bulundu

**Selector:** \`${info.selector}\`
**Tag:** ${info.tagName}
**ID:** ${info.id || "(yok)"}
**Class:** ${info.className || "(yok)"}
**Görünür:** ${info.visible ? "Evet" : "Hayır"}
**Devre dışı:** ${info.disabled ? "Evet" : "Hayır"}
**Boyut:** ${info.bounds?.width ?? 0}x${info.bounds?.height ?? 0}
**Pozisyon:** (${Math.round(info.bounds?.x ?? 0)}, ${Math.round(info.bounds?.y ?? 0)})
**İçerik:** "${info.textContent || "(boş)"}"`,
        }],
      };
    } else {
      return {
        content: [{ type: "text", text: `❌ Element bulunamadı: \`${selector}\`` }],
      };
    }
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Birden fazla elementi bul
 */
export async function queryElements(args: Record<string, unknown>): Promise<ToolResult> {
  const { selector, limit = 20 } = args as { selector?: string; limit?: number };
  
  if (!selector) {
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
    
    const list = elements.map(el => 
      `${el.index}. <${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""}> ${el.visible ? "👁" : "🚫"} "${el.textContent || ""}"`
    ).join("\n");
    
    return {
      content: [{
        type: "text",
        text: `✅ ${elements.length} element bulundu

**Selector:** \`${selector}\`

${list}`,
      }],
    };
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Klavye tuşu gönder
 */
export async function sendKeyPress(args: Record<string, unknown>): Promise<ToolResult> {
  const { key, ctrl = false, alt = false, shift = false, meta = false } = args as { key?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean };
  
  if (!key) {
    return {
      content: [{ type: "text", text: "❌ 'key' parametresi gerekli" }],
      isError: true,
    };
  }
  
  try {
    const result = await pressKey(key, { ctrl, alt, shift, meta });
    
    const modifiers = [
      ctrl && "Ctrl",
      alt && "Alt", 
      shift && "Shift",
      meta && "Meta",
    ].filter(Boolean).join("+");
    
    return {
      content: [{
        type: "text",
        text: `✅ Tuş gönderildi: ${modifiers ? modifiers + "+" : ""}${key}

**Hedef element:** <${result.target?.toLowerCase() || "unknown"}>`,
      }],
    };
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Tuş hatası: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Sayfada scroll yap
 */
export async function scrollPage(args: Record<string, unknown>): Promise<ToolResult> {
  const { x = 0, y = 0, behavior = "smooth" } = args as { x?: number; y?: number; behavior?: "smooth" | "instant" };
  
  try {
    const result = await scrollTo(x, y, behavior);
    
    return {
      content: [{
        type: "text",
        text: `✅ Scroll yapıldı

**Yeni pozisyon:** (${result.scrollX}, ${result.scrollY})`,
      }],
    };
  } catch (err) { const error = err as Error;
    return {
      content: [{ type: "text", text: `❌ Scroll hatası: ${error.message}` }],
      isError: true,
    };
  }
}
