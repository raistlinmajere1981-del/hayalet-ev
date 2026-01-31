/**
 * MCP Tool Definitions
 * All 97 tool definitions with enhanced metadata
 * @version 2.0.0 - Enhanced with metadata for auto-documentation
 */

import type { EnhancedToolDefinition, ToolMetadata } from '../types/index.js';

export const TOOL_DEFINITIONS = [
  // === Electron & Plugin Tool'ları ===
  {
    name: "hev_mcp_health",
    description: "Hayalet-ev MCP'nin sağlık durumunu kontrol et. Eğer bu tool çalışıyorsa, MCP aktif ve built-in override sistemi çalışıyor demektir.",
    inputSchema: { type: "object", properties: {} },
    metadata: {
      category: 'core',
      subcategory: 'health',
      priority: 'critical',
      complexity: 'simple',
      useCases: ['Session başlangıcında MCP sağlığını kontrol et', 'Tool çalışmıyorsa troubleshoot'],
      relatedTools: ['hev_list_tools'],
      agentGuidance: 'Her session başında veya tool hatası aldığında kullan. MCP çalışmazsa built-in toollar aktif olur (RISKLI!).',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['health', 'status', 'troubleshoot']
    }
  } as EnhancedToolDefinition,
  {
    name: "hev_test_electron",
    description: "Hayalet-ev Electron uygulamasını test et",
    inputSchema: {
      type: "object",
      properties: {
        timeout: { type: "number", description: "Test süresi (saniye), varsayılan 5", default: 5 },
      },
    },
    metadata: {
      category: 'electron',
      subcategory: 'testing',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Electron app connectivity test', 'CDP health check'],
      relatedTools: ['hev_check_electron_connection', 'hev_mcp_health'],
      agentGuidance: 'Use to verify Electron app is running and CDP is accessible.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['electron', 'testing', 'connectivity']
    }
  } as EnhancedToolDefinition,
  {
    name: "hev_list_tools",
    description: "Hayalet-ev MCP tool'larını kategorize ederek listele (97 tool)",
    inputSchema: { type: "object", properties: {} },
    metadata: {
      category: 'core',
      subcategory: 'discovery',
      priority: 'high',
      complexity: 'simple',
      useCases: ['Tool keşfetme', 'Kategori bazlı araştırma', 'Tool count doğrulama'],
      relatedTools: ['hev_suggest_tool', 'hev_tool_workflow'],
      agentGuidance: 'Tüm toolları görmek yerine hev_suggest_tool veya kategori bazlı arama kullan. 97 tool çok fazla!',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['discovery', 'list', 'reference']
    }
  } as EnhancedToolDefinition,
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
          default: [] as any[],
        },
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "Patterns to search and expand (function names, class names, etc.)",
          default: [] as any[],
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "hev_dev_fix_typescript_batch",
    description: "Toplu TypeScript hatalarını otomatik düzeltir (undefined checks, optional chaining)",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Düzeltilecek dosya yolu" },
        error_codes: { 
          type: "array", 
          items: { type: "string" },
          description: "Düzeltilecek hata kodları (örn: ['TS2532', 'TS18048'])",
          default: ["TS2532", "TS18048", "TS2722"]
        },
        fix_strategy: { 
          type: "string", 
          enum: ["add_guards", "add_assertions", "strict_null_check"],
          description: "Düzeltme stratejisi",
          default: "add_guards"
        },
        dry_run: { type: "boolean", description: "Sadece önizleme göster", default: true },
        auto_apply: { type: "boolean", description: "Otomatik uygula", default: false }
      },
      required: ["file_path"]
    }
  },
  {
    name: "hev_dev_typescript_dashboard",
    description: "TypeScript hatalarını analiz edip dashboard formatında gösterir",
    inputSchema: {
      type: "object",
      properties: {
        sort_by: { 
          type: "string", 
          enum: ["count", "severity", "file"],
          description: "Sıralama kriteri",
          default: "count"
        },
        group_by: { 
          type: "string", 
          enum: ["error_code", "file", "category"],
          description: "Gruplama kriteri",
          default: "error_code"
        },
        show_trend: { type: "boolean", description: "Trend göster", default: false },
        limit: { type: "number", description: "Maksimum item sayısı", default: 10 }
      }
    }
  },
  {
    name: "hev_dev_typescript_type_helper",
    description: "Type uyumsuzluklarını analiz edip çözüm önerir",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Analiz edilecek dosya yolu" },
        show_interfaces: { type: "boolean", description: "Interface tanımlarını göster", default: true },
        suggest_fixes: { type: "boolean", description: "Çözüm önerileri göster", default: true },
        analyze_conflicts: { type: "boolean", description: "Type conflict'leri detaylı analiz et", default: true }
      },
      required: ["file_path"]
    }
  },
  {
    name: "hev_dev_ast_insert",
    description: "TypeScript AST kullanarak kod ekler (duplicate prevention, smart positioning)",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Kod eklenecek dosya yolu" },
        after_pattern: { type: "string", description: "Hangi pattern'den sonra eklenecek" },
        insert_type: { 
          type: "string", 
          enum: ["if_block", "function", "method", "import", "export"],
          description: "Eklenecek kod tipi" 
        },
        code: { type: "string", description: "Eklenecek kod" },
        dry_run: { type: "boolean", description: "Sadece önizleme", default: true }
      },
      required: ["file_path", "after_pattern", "insert_type", "code"]
    }
  },
  {
    name: "hev_dev_safe_batch_refactor",
    description: "Toplu refactoring ile her adımda doğrulama ve otomatik rollback",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Refactor edilecek dosya" },
        operations: { 
          type: "array", 
          items: {
            type: "object",
            properties: {
              pattern: { type: "string" },
              replace_with: { type: "string" },
              target_lines: { type: "array", items: { type: "number" } }
            },
            required: ["pattern", "replace_with"]
          }
        },
        verify_after_each: { type: "boolean", default: true },
        auto_rollback_on_error: { type: "boolean", default: true },
        dry_run: { type: "boolean", default: false }
      },
      required: ["file_path", "operations"]
    }
  },
  {
    name: "hev_dev_smart_insert",
    description: "Natural language ile pozisyon bulma ve kod ekleme",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        anchor: { type: "string", description: "Natural language pozisyon" },
        position: { 
          type: "string", 
          enum: ["before", "after", "inside_start", "inside_end"],
          default: "after" 
        },
        code: { type: "string" },
        dry_run: { type: "boolean", default: true }
      },
      required: ["file_path", "anchor", "code"]
    }
  },
  {
    name: "hev_dev_register_tool",
    description: "Yeni tool otomatik olarak handlers, registry ve index'e ekler",
    inputSchema: {
      type: "object",
      properties: {
        tool_name: { type: "string" },
        description: { type: "string" },
        function_name: { type: "string" },
        tool_constant: { type: "string" },
        auto_add_to: { 
          type: "array", 
          items: { type: "string" },
          default: ["handlers", "registry", "index"] 
        },
        test_immediately: { type: "boolean", default: false },
        dry_run: { type: "boolean", default: true }
      },
      required: ["tool_name", "description", "function_name", "tool_constant"]
    }
  },
  {
    name: "hev_dev_lint_project",
    description: "Proje genelinde ESLint çalıştır (glob pattern ile batch linting)",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (örn: 'src/**/*.ts', 'mcp-server/**/*.ts')", default: "**/*.{js,ts,jsx,tsx}" },
        fix: { type: "boolean", description: "Otomatik düzeltme yap", default: false },
        max_warnings: { type: "number", description: "Maksimum uyarı sayısı (-1 = sınırsız)", default: -1 },
        cache: { type: "boolean", description: "Cache kullan (daha hızlı)", default: true },
        format: { type: "string", enum: ["stylish", "compact", "json", "codeframe"], description: "Çıktı formatı", default: "stylish" },
      },
    },
  },
  {
    name: "hev_dev_eslint_dashboard",
    description: "ESLint hatalarını analiz edip dashboard formatında gösterir (rule analytics, clustering)",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (örn: 'src/**/*.ts')", default: "**/*.{js,ts,jsx,tsx}" },
        sort_by: { type: "string", enum: ["count", "severity", "file"], description: "Sıralama kriteri", default: "count" },
        group_by: { type: "string", enum: ["rule", "file", "category"], description: "Gruplama kriteri", default: "rule" },
        limit: { type: "number", description: "Gösterilecek maksimum item sayısı", default: 10 },
        show_fixable: { type: "boolean", description: "Otomatik düzeltilecekleri göster", default: true },
      },
    },
  },
  {
    name: "hev_dev_eslint_batch_fix",
    description: "ESLint rule-based otomatik toplu düzeltme (batch auto-fix with verification)",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (örn: 'src/**/*.ts')", default: "**/*.{js,ts,jsx,tsx}" },
        rules: { type: "array", items: { type: "string" }, description: "Belirli rule'lar için fix (boş = tüm fixable rules)", default: [] },
        fix_strategy: { type: "string", enum: ["safe", "aggressive", "suggestion"], description: "Fix stratejisi (safe=problem+layout, aggressive=all, suggestion=only suggestions)", default: "safe" },
        dry_run: { type: "boolean", description: "Sadece analiz (değişiklik yapma)", default: false },
        auto_apply: { type: "boolean", description: "Otomatik uygula (onay bekleme)", default: false },
        verify_after: { type: "boolean", description: "Fix sonrası TypeScript check", default: true },
      },
    },
  },
  
];
