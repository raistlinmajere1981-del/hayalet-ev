/**
 * DebugTools - Hata analizi ve debugging araçları
 */

import type { ToolResult } from "@shared/index-mcp.js";

/** Error pattern interface */
interface ErrorPattern {
  pattern: RegExp;
  category: string;
  suggestion: string;
  checkFiles: (provider?: string) => string[];
  severity: "high" | "medium" | "low";
}

/**
 * Error pattern'leri
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /Cannot read propert(?:y|ies).*of (?:null|undefined)/i,
    category: "dom-selector",
    suggestion: "Selector muhtemelen değişti. Provider'ın DOM yapısını kontrol et.",
    checkFiles: (provider) =>
      provider !== undefined && provider.length > 0
        ? [`src/js/modules/webview/providers/${provider}/config.js`]
        : [],
    severity: "high",
  },
  {
    pattern: /net::ERR_INTERNET_DISCONNECTED/i,
    category: "network",
    suggestion: "İnternet bağlantısı yok.",
    checkFiles: () => [],
    severity: "high",
  },
  {
    pattern: /net::ERR_NAME_NOT_RESOLVED/i,
    category: "network",
    suggestion: "DNS çözümlenemedi. Site erişilebilir mi kontrol et.",
    checkFiles: () => [],
    severity: "high",
  },
  {
    pattern: /Timeout|ETIMEDOUT/i,
    category: "timeout",
    suggestion: "İşlem zaman aşımına uğradı. Ağ yavaş veya site yanıt vermiyor olabilir.",
    checkFiles: () => ["src/js/constants/timeouts.js"],
    severity: "medium",
  },
  {
    pattern: /ENOENT/i,
    category: "filesystem",
    suggestion: "Dosya bulunamadı. Yol doğru mu kontrol et.",
    checkFiles: () => [],
    severity: "medium",
  },
  {
    pattern: /WebSocket.*close|ECONNRESET/i,
    category: "connection",
    suggestion: "Bağlantı koptu. Electron veya site yeniden başlatılabilir.",
    checkFiles: () => [],
    severity: "medium",
  },
  {
    pattern: /Invalid state|already|disposed/i,
    category: "state",
    suggestion: "Geçersiz durum. Webview lifecycle kontrolü yap.",
    checkFiles: () => ["src/js/modules/webview/lifecycle-manager.js"],
    severity: "low",
  },
];

/** Match result interface */
interface MatchResult {
  category: string;
  suggestion: string;
  checkFiles: string[];
  severity: "high" | "medium" | "low";
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

/**
 * Error pattern'i eşleştir (internal helper)
 */
function matchErrorPattern(
  errorMessage: string,
  provider: string | null = null
): MatchResult | null {
  for (const p of ERROR_PATTERNS) {
    if (p.pattern.test(errorMessage)) {
      return {
        category: p.category,
        suggestion: p.suggestion,
        checkFiles: p.checkFiles(provider ?? undefined),
        severity: p.severity,
      };
    }
  }

  return null;
}

/**
 * Hata mesajını analiz et ve ipucu ver
 */
export function getErrorHints(args: Record<string, unknown>): ToolResult {
  const { errorMessage, provider } = args as { errorMessage?: string; provider?: string };

  if (!isNonEmptyString(errorMessage)) {
    return {
      content: [{ type: "text", text: "❌ 'errorMessage' parametresi gerekli" }],
      isError: true,
    };
  }

  // Pattern'leri kontrol et
  for (const ep of ERROR_PATTERNS) {
    if (ep.pattern.test(errorMessage)) {
      const hint = {
        ...ep,
        checkFiles: ep.checkFiles(provider),
      };

      const output = `🔍 Hata Analizi:

📝 Mesaj: "${errorMessage}"

📂 Kategori: ${hint.category}
⚠️ Önem: ${hint.severity}

💡 Öneri:
${hint.suggestion}

${hint.checkFiles.length > 0 ? `📁 Kontrol Edilecek Dosyalar:\n${hint.checkFiles.map((f) => `- ${f}`).join("\n")}` : ""}`;

      return {
        content: [{ type: "text", text: output }],
      };
    }
  }

  // Eşleşme bulunamadı
  return {
    content: [
      {
        type: "text",
        text: `🔍 Hata analizi:\n\n"${errorMessage}"\n\n❓ Bu hata için bilinen bir pattern bulunamadı.\n\nÖneriler:\n- Log dosyalarını incele\n- Stack trace'i kontrol et\n- İlgili kodu debug et`,
      },
    ],
  };
}

/**
 * Hata bağlamını toplayıp özetler
 */
export function collectErrorContext(args: Record<string, unknown>): ToolResult {
  const { command, errorMessage, logSnippet, provider, fileContext, hint } = args as {
    command?: string;
    errorMessage?: string;
    logSnippet?: string;
    provider?: string;
    fileContext?: string[];
    hint?: string;
  };

  if (!isNonEmptyString(errorMessage) && !isNonEmptyString(logSnippet)) {
    return {
      content: [{ type: "text", text: "❌ 'errorMessage' veya 'logSnippet' parametresi gerekli" }],
      isError: true,
    };
  }

  const matched = isNonEmptyString(errorMessage)
    ? matchErrorPattern(errorMessage, provider ?? null)
    : null;
  const nextChecks: string[] = [];

  if (matched !== null && matched.checkFiles.length > 0) {
    nextChecks.push(...matched.checkFiles);
  }

  if (fileContext && fileContext.length > 0) {
    nextChecks.push(...fileContext);
  }

  const output = [
    "🧭 Hata Bağlam Özeti",
    "",
    isNonEmptyString(errorMessage) ? `📝 Hata: ${errorMessage}` : undefined,
    isNonEmptyString(command) ? `🧪 Komut: ${command}` : undefined,
    isNonEmptyString(provider) ? `🤖 Provider: ${provider}` : undefined,
    isNonEmptyString(logSnippet) ? `📄 Log Parçası:\n${logSnippet}` : undefined,
    isNonEmptyString(hint) ? `💡 Ek Not: ${hint}` : undefined,
    matched
      ? `📂 Kategori: ${matched.category} | Önem: ${matched.severity}`
      : "📂 Kategori: bilinmiyor",
    matched !== null && matched.suggestion.length > 0
      ? `✅ Öneri: ${matched.suggestion}`
      : "✅ Öneri: Log/stack trace kontrol et",
    nextChecks.length > 0
      ? `🔍 Kontrol Noktaları:\n${nextChecks.map((item) => `- ${item}`).join("\n")}`
      : "🔍 Kontrol Noktaları: yok",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");

  return {
    content: [{ type: "text", text: output }],
  };
}
