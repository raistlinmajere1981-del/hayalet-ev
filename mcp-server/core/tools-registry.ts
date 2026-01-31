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
    metadata: {
      category: 'debug',
      subcategory: 'logs',
      priority: 'high',
      complexity: 'medium',
      useCases: ['Hata ayıklama için log inceleme', 'Belirli source/level/pattern ile filtreleme', 'Correlation ID ile işlem takibi'],
      relatedTools: ['hev_list_log_sessions', 'hev_get_session_summary', 'hev_get_error_hints'],
      agentGuidance: 'Hata araştırması için kullan. source ile WEBVIEW-AI1, WEBVIEW-AI2 vb. ayır. correlationId ile işlem zincirini takip et.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['debug', 'logs', 'troubleshooting', 'electron']
    }
  } as EnhancedToolDefinition,
  {
    name: "hev_list_log_sessions",
    description: "Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Gösterilecek maksimum session sayısı (varsayılan: 10)", default: 10 },
      },
    },
    metadata: {
      category: 'debug',
      subcategory: 'logs',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Geçmiş session\'ları görüntüleme', 'Belirli bir session ID bulma'],
      relatedTools: ['hev_read_electron_logs', 'hev_get_session_summary'],
      agentGuidance: 'Log okumadan önce session listesini kontrol et. En son session varsayılan olarak kullanılır.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['debug', 'logs', 'session']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'debug',
      subcategory: 'error-analysis',
      priority: 'high',
      complexity: 'medium',
      useCases: ['Hata pattern matching', 'Çözüm önerisi alma', 'Provider-specific troubleshooting'],
      relatedTools: ['hev_collect_error_context', 'hev_read_electron_logs'],
      agentGuidance: 'Hata mesajı aldığında bu tool ile bilinen pattern\'leri kontrol et. Provider bilgisi verirsen dosya yolları için kullanır.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['debug', 'error', 'hints', 'ai-assisted']
    }
  } as EnhancedToolDefinition,
  {
    name: "hev_get_session_summary",
    description: "Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID (varsayılan: en son session)" },
      },
    },
    metadata: {
      category: 'debug',
      subcategory: 'logs',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Session health check', 'Hata istatistikleri görme', 'Session karşılaştırması'],
      relatedTools: ['hev_list_log_sessions', 'hev_read_electron_logs'],
      agentGuidance: 'Session\'ın genel durumunu öğrenmek için kullan. Hata sayısı, süre ve durum bilgisi verir.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['debug', 'logs', 'session', 'summary']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'debug',
      subcategory: 'error-analysis',
      priority: 'high',
      complexity: 'medium',
      useCases: ['Hata context toplama', 'Error report oluşturma', 'Debugging için context sağlama'],
      relatedTools: ['hev_get_error_hints', 'hev_read_electron_logs'],
      agentGuidance: 'Hata aldığında komut, log, dosya gibi bağlamsal bilgileri topla. Bu tool structured error context oluşturur.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['debug', 'error', 'context', 'analysis']
    }
  } as EnhancedToolDefinition,


  // === CDP (Chrome DevTools Protocol) Tool'ları ===
  {
    name: "hev_check_electron_connection",
    description: "Electron uygulamasına CDP bağlantısını kontrol et. Uygulama çalışıyor mu ve debug portu açık mı?",
    inputSchema: { type: "object", properties: {} },
    metadata: {
      category: 'electron',
      subcategory: 'cdp',
      priority: 'high',
      complexity: 'simple',
      useCases: ['CDP connectivity check', 'Electron app health', 'Debugging başlangıcı'],
      relatedTools: ['hev_test_electron', 'hev_send_command_to_electron'],
      agentGuidance: 'CDP operasyonlarından önce bağlantıyı kontrol et. Debug port açık mı?',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'connectivity', 'electron', 'health']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp',
      priority: 'high',
      complexity: 'medium',
      useCases: ['DOM manipulation', 'State inspection', 'Custom JS execution'],
      relatedTools: ['hev_inspect_element', 'hev_get_page_dom_structure'],
      agentGuidance: 'Powerful tool: herhangi bir JS çalıştır. State değişikliği, data inspection için kullan.',
      requiresConfirmation: false,
      riskLevel: 'medium',
      tags: ['cdp', 'javascript', 'execution', 'advanced']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Visual debugging', 'UI verification', 'Documentation'],
      relatedTools: ['hev_get_electron_window_info', 'hev_inspect_element'],
      agentGuidance: 'UI state\'i görsel olarak kaydet. Full page screenshot destekler.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'screenshot', 'visual', 'debugging']
    }
  } as EnhancedToolDefinition,
  {
    name: "hev_get_electron_window_info",
    description: "Electron penceresinin boyut, pozisyon ve URL bilgilerini al.",
    inputSchema: { type: "object", properties: {} },
    metadata: {
      category: 'electron',
      subcategory: 'cdp',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Window state inspection', 'Layout debugging', 'URL verification'],
      relatedTools: ['hev_take_cdp_screenshot', 'hev_check_electron_connection'],
      agentGuidance: 'Pencere durumunu öğren: boyut, pozisyon, URL. Layout sorunları için kullan.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'window', 'info', 'layout']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp-interaction',
      priority: 'high',
      complexity: 'simple',
      useCases: ['UI automation', 'Button clicks', 'Element interaction'],
      relatedTools: ['hev_click_element_by_text', 'hev_inspect_element', 'hev_query_elements'],
      agentGuidance: 'CSS selector ile element tıkla. Önce hev_inspect_element ile elementin var olduğunu doğrula.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'click', 'interaction', 'automation']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp-interaction',
      priority: 'high',
      complexity: 'simple',
      useCases: ['Text-based interaction', 'Button clicks by label', 'Link clicks'],
      relatedTools: ['hev_click_element_by_selector', 'hev_query_elements'],
      agentGuidance: 'Metin ile element bul ve tıkla. Selector bilmiyorsan bu tool kullanışlı.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'click', 'text', 'automation']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp-interaction',
      priority: 'high',
      complexity: 'simple',
      useCases: ['Form filling', 'Input automation', 'Text entry'],
      relatedTools: ['hev_send_key_press', 'hev_click_element_by_selector'],
      agentGuidance: 'Input field\'a değer yaz. clear=true ile önce mevcut içeriği temizler.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'input', 'form', 'automation']
    }
  } as EnhancedToolDefinition,
  {
    name: "hev_get_page_dom_structure",
    description: "Sayfanın DOM yapısını al. Debug ve element bulma için kullanışlı.",
    inputSchema: {
      type: "object",
      properties: {
        maxDepth: { type: "number", description: "Maksimum DOM derinliği", default: 3 },
      },
    },
    metadata: {
      category: 'electron',
      subcategory: 'cdp-inspection',
      priority: 'high',
      complexity: 'medium',
      useCases: ['DOM exploration', 'Element discovery', 'Structure debugging'],
      relatedTools: ['hev_inspect_element', 'hev_query_elements'],
      agentGuidance: 'Sayfanın DOM yapısını görüntüle. Element selector\'ı bulmak için kullan. maxDepth ile derinliği kontrol et.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'dom', 'inspection', 'debugging']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp-inspection',
      priority: 'high',
      complexity: 'simple',
      useCases: ['Element debugging', 'Layout inspection', 'Visibility check'],
      relatedTools: ['hev_query_elements', 'hev_get_page_dom_structure', 'hev_click_element_by_selector'],
      agentGuidance: 'Element\'in detaylı bilgilerini al. Tıklamadan önce görünür mü kontrol et.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'inspect', 'element', 'debugging']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp-inspection',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Multiple elements search', 'Element counting', 'Selector validation'],
      relatedTools: ['hev_inspect_element', 'hev_get_page_dom_structure'],
      agentGuidance: 'Selector ile eşleşen tüm elementleri bul. Birden fazla element varsa hangi indexte olduğunu öğren.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'query', 'elements', 'search']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp-interaction',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Keyboard automation', 'Form submission', 'Navigation keys'],
      relatedTools: ['hev_fill_input_field', 'hev_click_element_by_selector'],
      agentGuidance: 'Klavye tuşu gönder. Enter ile form submit, Tab ile navigation, Escape ile cancel işlemleri.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'keyboard', 'key', 'automation']
    }
  } as EnhancedToolDefinition,
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
    metadata: {
      category: 'electron',
      subcategory: 'cdp-navigation',
      priority: 'low',
      complexity: 'simple',
      useCases: ['Page scrolling', 'Element visibility', 'Long page navigation'],
      relatedTools: ['hev_take_cdp_screenshot', 'hev_inspect_element'],
      agentGuidance: 'Sayfayı scroll et. Element görünür hale getirmek veya tam sayfa screenshot almak için kullan.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['cdp', 'scroll', 'navigation', 'page']
    }
  } as EnhancedToolDefinition,
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
    },
    metadata: {
      category: 'development',
      subcategory: 'typescript',
      priority: 'high',
      complexity: 'complex',
      useCases: [
        'Auto-fix TypeScript null/undefined errors',
        'Batch fix TS2532, TS18048 errors',
        'Add type guards and optional chaining'
      ],
      relatedTools: ['hev_dev_typescript_dashboard', 'hev_dev_typescript_type_helper', 'hev_fs_backup'],
      agentGuidance: 'ALWAYS use dry_run=true first. Use hev_dev_typescript_dashboard to identify error codes. Supports multiple fix strategies.',
      requiresConfirmation: false,
      riskLevel: 'medium',
      tags: ['typescript', 'auto-fix', 'batch', 'type-safety']
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
    },
    metadata: {
      category: 'development',
      subcategory: 'typescript',
      priority: 'high',
      complexity: 'medium',
      useCases: [
        'Analyze TypeScript errors by category',
        'Identify most common error codes',
        'Get overview of type issues in project'
      ],
      relatedTools: ['hev_dev_fix_typescript_batch', 'hev_dev_typescript_type_helper'],
      agentGuidance: 'Use FIRST to understand TypeScript error landscape. Shows analytics with grouping and sorting. Helps prioritize fixes.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['typescript', 'analytics', 'dashboard', 'error-analysis']
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
    },
    metadata: {
      category: 'development',
      subcategory: 'typescript',
      priority: 'medium',
      complexity: 'medium',
      useCases: [
        'Analyze type mismatches',
        'Suggest interface improvements',
        'Identify type conflict sources'
      ],
      relatedTools: ['hev_dev_typescript_dashboard', 'hev_dev_fix_typescript_batch'],
      agentGuidance: 'Use for deep type analysis. Shows interfaces and suggests fixes. Good for understanding complex type errors.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['typescript', 'type-analysis', 'interface', 'conflict-resolution']
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
    },
    metadata: {
      category: 'development',
      subcategory: 'code-editing',
      priority: 'high',
      complexity: 'complex',
      useCases: [
        'Insert code with AST awareness',
        'Prevent duplicate imports/functions',
        'Smart positioning (after specific patterns)'
      ],
      relatedTools: ['hev_dev_smart_insert', 'hev_fs_find_and_replace', 'hev_dev_edit_lines'],
      agentGuidance: 'Use for AST-aware code insertion. Prevents duplicates and positions code intelligently. ALWAYS use dry_run=true first.',
      requiresConfirmation: false,
      riskLevel: 'medium',
      tags: ['ast', 'insert', 'duplicate-prevention', 'smart-positioning']
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
    },
    metadata: {
      category: 'development',
      subcategory: 'refactoring',
      priority: 'high',
      complexity: 'complex',
      useCases: [
        'Multi-step refactoring with safety',
        'Batch operations with rollback',
        'Verified transformations'
      ],
      relatedTools: ['hev_fs_find_and_replace', 'hev_fs_backup', 'hev_dev_check_syntax'],
      agentGuidance: 'Use for complex refactoring. Each step is verified. Auto-rollback on error. Safer than manual multi-step edits.',
      requiresConfirmation: false,
      riskLevel: 'medium',
      tags: ['refactoring', 'batch', 'verification', 'rollback', 'safety']
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
    },
    metadata: {
      category: 'development',
      subcategory: 'code-editing',
      priority: 'medium',
      complexity: 'medium',
      useCases: [
        'Insert code using natural language positioning',
        'Smart anchor-based insertion',
        'Human-readable position descriptions'
      ],
      relatedTools: ['hev_dev_ast_insert', 'hev_fs_find_and_replace'],
      agentGuidance: 'Use when exact position is unclear. Anchor can be natural language like "after the last import" or "inside MyClass". ALWAYS use dry_run=true first.',
      requiresConfirmation: false,
      riskLevel: 'medium',
      tags: ['insert', 'natural-language', 'smart-positioning', 'anchor-based']
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
    },
    metadata: {
      category: 'development',
      subcategory: 'tool-management',
      priority: 'low',
      complexity: 'medium',
      useCases: [
        'Register new MCP tools automatically',
        'Update handlers, registry, and index',
        'Streamline tool development'
      ],
      relatedTools: ['hev_fs_find_and_replace', 'hev_dev_ast_insert'],
      agentGuidance: 'Use for adding new tools to MCP server. Automates registration process. ALWAYS use dry_run=true first to preview changes.',
      requiresConfirmation: false,
      riskLevel: 'medium',
      tags: ['tool-management', 'registration', 'automation', 'meta']
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
    metadata: {
      category: 'development',
      subcategory: 'eslint',
      priority: 'high',
      complexity: 'medium',
      useCases: [
        'Run ESLint across entire project',
        'Batch linting with glob patterns',
        'Project-wide code quality check'
      ],
      relatedTools: ['hev_dev_eslint_dashboard', 'hev_dev_eslint_batch_fix'],
      agentGuidance: 'Use for project-wide linting. Supports glob patterns and caching. Use fix=false first to see issues.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['eslint', 'linting', 'batch', 'project-wide']
    }
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
    metadata: {
      category: 'development',
      subcategory: 'eslint',
      priority: 'high',
      complexity: 'medium',
      useCases: [
        'Analyze ESLint errors by rule',
        'Identify most common violations',
        'Prioritize which rules to fix'
      ],
      relatedTools: ['hev_dev_lint_project', 'hev_dev_eslint_batch_fix'],
      agentGuidance: 'Use FIRST to understand ESLint error distribution. Shows analytics with clustering. Helps plan fixes.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['eslint', 'analytics', 'dashboard', 'rule-analysis']
    }
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
    metadata: {
      category: 'development',
      subcategory: 'eslint',
      priority: 'high',
      complexity: 'complex',
      useCases: [
        'Batch fix ESLint violations',
        'Auto-fix specific rules',
        'Safe automated code cleanup'
      ],
      relatedTools: ['hev_dev_eslint_dashboard', 'hev_dev_lint_project', 'hev_fs_backup'],
      agentGuidance: 'ALWAYS use dry_run=true first. Use hev_dev_eslint_dashboard to identify rules. Supports safe/aggressive strategies with verification.',
      requiresConfirmation: false,
      riskLevel: 'medium',
      tags: ['eslint', 'auto-fix', 'batch', 'verification']
    }
  },
  
];
