/**
 * MCP Tool Definitions
 * All 87+ tool definitions (types, descriptions, input schemas)
 */

export const TOOL_DEFINITIONS = [
  // === Electron & Plugin Tool'ları ===
  {
    name: "hev_mcp_health",
    description: "Hayalet-ev MCP'nin sağlık durumunu kontrol et. Eğer bu tool çalışıyorsa, MCP aktif ve built-in override sistemi çalışıyor demektir.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hev_test_electron",
    description: "Hayalet-ev Electron uygulamasını test et",
    inputSchema: {
      type: "object",
      properties: {
        timeout: { type: "number", description: "Test süresi (saniye), varsayılan 5", default: 5 },
      },
    },
  },
  {
    name: "hev_list_tools",
    description: "Hayalet-ev MCP tool'larını kategorize ederek listele (87 tool)",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hev_read_electron_logs",
    description: "Electron console ve error loglarını oku. Gelişmiş filtreleme: source (MAIN, RENDERER, WEBVIEW-AI1, etc.), level (LOG, WARN, ERROR), içerik arama, correlation ID ile işlem takibi.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["console", "error", "all", "structured"], description: "Log tipi", default: "all" },
        tail: { type: "number", description: "Son N satırı göster (varsayılan: 50)", default: 50 },
        source: { type: "string", description: "Kaynak filtresi: MAIN, RENDERER, WEBVIEW-AI1, WEBVIEW-AI2, WEBVIEW-* (glob destekli)" },
        level: { type: "string", enum: ["LOG", "WARN", "ERROR", "DEBUG", "INFO"], description: "Log seviyesi filtresi" },
        contains: { type: "string", description: "İçerik arama (case-insensitive)" },
        correlationId: { type: "string", description: "İşlem takibi için correlation ID" },
        sessionId: { type: "string", description: "Belirli bir session'ın loglarını oku (varsayılan: en son session)" },
      },
    },
  },
  {
    name: "hev_list_log_sessions",
    description: "Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Gösterilecek maksimum session sayısı (varsayılan: 10)", default: 10 },
      },
    },
  },
  {
    name: "hev_get_error_hints",
    description: "Belirli bir hata mesajı için AI debugging ipuçları al. Bilinen hata pattern'lerini eşleştirir ve çözüm önerileri sunar.",
    inputSchema: {
      type: "object",
      properties: {
        errorMessage: { type: "string", description: "Analiz edilecek hata mesajı" },
        provider: { type: "string", description: "İlgili provider (chatgpt, gemini, grok) - dosya yolları için kullanılır" },
      },
      required: ["errorMessage"],
    },
  },
  {
    name: "hev_get_session_summary",
    description: "Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID (varsayılan: en son session)" },
      },
    },
  },
  {
    name: "hev_collect_error_context",
    description: "Hata bağlamını toplayıp özetler (komut, log, kategori, öneri)",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Çalıştırılan komut" },
        errorMessage: { type: "string", description: "Hata mesajı" },
        logSnippet: { type: "string", description: "Log parçası" },
        provider: { type: "string", description: "Provider adı (opsiyonel)" },
        fileContext: { type: "array", items: { type: "string" }, description: "İlgili dosyalar" },
        hint: { type: "string", description: "Ek not" },
      },
      required: ["errorMessage"],
    },
  },


  // === CDP (Chrome DevTools Protocol) Tool'ları ===
  {
    name: "hev_check_electron_connection",
    description: "Electron uygulamasına CDP bağlantısını kontrol et. Uygulama çalışıyor mu ve debug portu açık mı?",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hev_send_command_to_electron",
    description: "Electron uygulamasında JavaScript kodu çalıştır. Herhangi bir JS expression çalıştırabilir.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Çalıştırılacak JavaScript kodu" },
        description: { type: "string", description: "Komutun ne yaptığına dair açıklama (opsiyonel)" },
      },
      required: ["command"],
    },
  },
  {
    name: "hev_take_cdp_screenshot",
    description: "Electron penceresinin ekran görüntüsünü al (CDP üzerinden, tam sayfa).",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["png", "jpeg"], description: "Görüntü formatı", default: "png" },
        quality: { type: "number", description: "JPEG kalitesi (1-100)", default: 80 },
        savePath: { type: "string", description: "Dosya kaydetme yolu (opsiyonel)" },
      },
    },
  },
  {
    name: "hev_get_electron_window_info",
    description: "Electron penceresinin boyut, pozisyon ve URL bilgilerini al.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hev_click_element_by_selector",
    description: "CSS selector ile bir elemente tıkla.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector (örn: #myButton, .btn-primary, button[type='submit'])" },
      },
      required: ["selector"],
    },
  },
  {
    name: "hev_click_element_by_text",
    description: "Metin içeriğine göre bir elemente tıkla.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Aranacak metin içeriği" },
        tagName: { type: "string", description: "Tag filtresi (button, a, div vb.)", default: "*" },
      },
      required: ["text"],
    },
  },
  {
    name: "hev_fill_input_field",
    description: "Bir input alanına değer yaz.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Input elementinin CSS selector'ı" },
        value: { type: "string", description: "Yazılacak değer" },
        clear: { type: "boolean", description: "Önce mevcut değeri temizle", default: true },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "hev_get_page_dom_structure",
    description: "Sayfanın DOM yapısını al. Debug ve element bulma için kullanışlı.",
    inputSchema: {
      type: "object",
      properties: {
        maxDepth: { type: "number", description: "Maksimum DOM derinliği", default: 3 },
      },
    },
  },
  {
    name: "hev_inspect_element",
    description: "Bir elementin detaylı bilgilerini al (boyut, pozisyon, görünürlük, içerik).",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
      },
      required: ["selector"],
    },
  },
  {
    name: "hev_query_elements",
    description: "Bir selector ile eşleşen tüm elementleri bul ve listele.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
        limit: { type: "number", description: "Maksimum sonuç sayısı", default: 20 },
      },
      required: ["selector"],
    },
  },
  {
    name: "hev_send_key_press",
    description: "Klavye tuşu gönder (Enter, Escape, Tab vb.).",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Tuş adı (Enter, Escape, Tab, ArrowDown vb.)" },
        ctrl: { type: "boolean", description: "Ctrl tuşu basılı", default: false },
        alt: { type: "boolean", description: "Alt tuşu basılı", default: false },
        shift: { type: "boolean", description: "Shift tuşu basılı", default: false },
        meta: { type: "boolean", description: "Meta/Cmd tuşu basılı", default: false },
      },
      required: ["key"],
    },
  },
  {
    name: "hev_scroll_page",
    description: "Sayfada belirli bir konuma scroll yap.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Yatay scroll pozisyonu", default: 0 },
        y: { type: "number", description: "Dikey scroll pozisyonu", default: 0 },
        behavior: { type: "string", enum: ["smooth", "instant"], description: "Scroll animasyonu", default: "smooth" },
      },
    },
  },
];

// === ROVODEV BUILT-IN OVERRIDE TOOLS ===
// These tools override buggy Rovodev built-in tools with safe implementations

export const OVERRIDE_TOOL_DEFINITIONS = [
  {
    name: "find_and_replace_code",
    description: "SAFE VERSION: Find and replace code with context preview. Overrides Rovodev built-in to prevent duplicate lines.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file",
        },
        find: {
          type: "string",
          description: "Code to find (exact match)",
        },
        replace: {
          type: "string",
          description: "Code to replace with",
        },
        ignore_whitespace: {
          type: "boolean",
          description: "Ignore whitespace differences (default: false)",
          default: false,
        },
        dry_run: {
          type: "boolean",
          description: "Preview changes without applying (default: false)",
          default: false,
        },
      },
      required: ["file_path", "find", "replace"],
    },
  },
  {
    name: "expand_code_chunks",
    description: "SAFE VERSION: Expand code by line ranges or patterns. Overrides Rovodev built-in.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file",
        },
        line_ranges: {
          type: "array",
          items: {
            type: "array",
            items: { type: "number" },
          },
          description: "Line ranges to expand [[start, end], ...]",
          default: [],
        },
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "Patterns to search and expand (function names, class names, etc.)",
          default: [],
        },
      },
      required: ["file_path"],
    },
  },
];
