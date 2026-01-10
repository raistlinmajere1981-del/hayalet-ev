/**
 * DebugTools - Hata analizi ve debugging araçları
 */

/**
 * Error pattern'leri
 */
const ERROR_PATTERNS = [
  {
    pattern: /Cannot read propert(?:y|ies).*of (?:null|undefined)/i,
    category: "dom-selector",
    suggestion: "Selector muhtemelen değişti. Provider'ın DOM yapısını kontrol et.",
    checkFiles: (provider) => provider ? [`src/js/modules/webview/providers/${provider}/config.js`] : [],
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
    suggestion: "DNS çözümlemesi başarısız. Domain adını kontrol et.",
    checkFiles: () => [],
    severity: "high",
  },
  {
    pattern: /ipcRenderer.*timed out/i,
    category: "ipc",
    suggestion: "IPC çağrısı zaman aşımına uğradı. Main process yanıt vermiyor olabilir.",
    checkFiles: () => ["electron/main.js"],
    severity: "high",
  },
  {
    pattern: /Webview.*crashed/i,
    category: "webview-crash",
    suggestion: "Webview çöktü. Sayfayı yeniden yükle.",
    checkFiles: () => ["src/js/modules/webview-manager.js"],
    severity: "critical",
  },
  {
    pattern: /out of memory|heap.*exceeded/i,
    category: "memory",
    suggestion: "Bellek yetersiz. Uygulamayı yeniden başlat.",
    checkFiles: () => [],
    severity: "critical",
  },
  {
    pattern: /rate.?limit/i,
    category: "provider-limit",
    suggestion: "Rate limit hatası. Bekleyip tekrar dene.",
    checkFiles: () => [],
    severity: "medium",
  },
];

/**
 * Error pattern matching
 * @param {string} errorMessage
 * @param {string} [provider]
 * @returns {object|null}
 */
export function matchErrorPattern(errorMessage, provider = null) {
  for (const p of ERROR_PATTERNS) {
    if (p.pattern.test(errorMessage)) {
      return {
        category: p.category,
        suggestion: p.suggestion,
        checkFiles: p.checkFiles(provider),
        severity: p.severity,
      };
    }
  }
  
  return null;
}

/**
 * get_error_hints handler
 */
export async function getErrorHints(_logDir, args) {
  const { errorMessage, provider } = args || {};
  
  if (!errorMessage) {
    return {
      content: [{ type: "text", text: "❌ errorMessage parametresi gerekli" }],
      isError: true,
    };
  }
  
  const hint = matchErrorPattern(errorMessage, provider);
  
  if (!hint) {
    return {
      content: [
        {
          type: "text",
          text: `🔍 Hata analizi:\n\n"${errorMessage}"\n\n❓ Bu hata için bilinen bir pattern bulunamadı.\n\nÖneriler:\n- Log dosyalarını incele\n- Stack trace'i kontrol et\n- İlgili kodu debug et`,
        },
      ],
    };
  }
  
  const output = `🔍 Hata Analizi:

📝 Mesaj: "${errorMessage}"

📂 Kategori: ${hint.category}
⚠️ Önem: ${hint.severity}

💡 Öneri:
${hint.suggestion}

${hint.checkFiles.length > 0 ? `📁 Kontrol Edilecek Dosyalar:\n${hint.checkFiles.map(f => `- ${f}`).join("\n")}` : ""}`;
  
  return {
    content: [{ type: "text", text: output }],
  };
}
