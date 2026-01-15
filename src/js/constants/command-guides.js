/**
 * Server Komutları Kullanım Kılavuzları
 * Her komut için açıklama ve örnek kullanım
 */

export const COMMAND_GUIDES = {
  DeviceManager: {
    name: "DeviceManager",
    description: "Fare ve klavye kontrolü sağlar. Mouse hareketi, tıklama ve klavye tuş simülasyonu yapabilir.",
    parameters: [
      { name: "action", type: "string", required: true, description: "İşlem türü: mousemove, click, type, key" },
      { name: "...params", type: "any", required: false, description: "İşleme göre değişen parametreler" },
    ],
    examples: [
      { code: '++cmd:DeviceManager(mousemove, 500, 300)', description: "Fareyi x:500, y:300 koordinatına taşı" },
      { code: '++cmd:DeviceManager(click, left)', description: "Sol tıklama yap" },
      { code: '++cmd:DeviceManager(click, right)', description: "Sağ tıklama yap" },
      { code: '++cmd:DeviceManager(type, "Merhaba Dünya")', description: "Klavyeden metin yaz" },
      { code: '++cmd:DeviceManager(key, Enter)', description: "Enter tuşuna bas" },
    ],
  },

  FileManager: {
    name: "FileManager",
    description: "Dosya sistemi işlemleri. Dosya okuma, yazma ve listeleme yapabilir.",
    parameters: [
      { name: "action", type: "string", required: true, description: "İşlem türü: read, write, list" },
      { name: "path", type: "string", required: true, description: "Dosya veya klasör yolu" },
    ],
    examples: [
      { code: '++cmd:FileManager(list, ./)', description: "Mevcut klasördeki dosyaları listele" },
      { code: '++cmd:FileManager(read, ./README.md)', description: "README.md dosyasını oku" },
    ],
  },

  WebviewManager: {
    name: "WebviewManager",
    description: "AI webview'larını yönetir. Sayfa yenileme, URL değiştirme gibi işlemler.",
    parameters: [
      { name: "action", type: "string", required: true, description: "İşlem türü: reload, navigate, focus" },
      { name: "target", type: "string", required: false, description: "Hedef slot: ai1, ai2" },
    ],
    examples: [
      { code: '++cmd:WebviewManager(reload, ai1)', description: "AI1 webview'ını yenile" },
      { code: '++cmd:WebviewManager(focus, ai2)', description: "AI2 webview'ına odaklan" },
    ],
  },

  WhisperManager: {
    name: "WhisperManager",
    description: "Fısıltı (whisper) mesajları yönetir. AI'lara gizli notlar ve hatırlatmalar ekler.",
    parameters: [
      { name: "user", type: "string", required: true, description: "Hedef: ai1, ai2 veya user" },
      { name: "text", type: "string", required: true, description: "Fısıltı mesajı içeriği" },
      { name: "when", type: "string", required: false, description: "Ne zaman gösterilecek (opsiyonel)" },
    ],
    examples: [
      { code: '++cmd:WhisperManager("ai1", "Kullanıcıya nazik ol", "")', description: "AI1'e fısıltı ekle" },
      { code: '++cmd:WhisperManager("ai2", "Kısa cevaplar ver", "next")', description: "AI2'ye sonraki mesajda gösterilecek fısıltı" },
      { code: '++cmd:WhisperManager("user", "Toplantı 14:00", "")', description: "Kullanıcıya hatırlatma" },
    ],
  },

  WindowManager: {
    name: "WindowManager",
    description: "Uygulama penceresini kontrol eder. Minimize, maximize, restore işlemleri.",
    parameters: [
      { name: "action", type: "string", required: true, description: "İşlem: minimize, fullscreen, maximize, restore" },
    ],
    examples: [
      { code: '++cmd:WindowManager(minimize)', description: "Pencereyi küçült" },
      { code: '++cmd:WindowManager(fullscreen)', description: "Tam ekran yap" },
      { code: '++cmd:WindowManager(restore)', description: "Normal boyuta getir" },
    ],
  },

  ScreenshotManager: {
    name: "ScreenshotManager",
    description: "Ekran görüntüsü alır. Tüm ekran veya belirli bir bölge seçilebilir.",
    parameters: [
      { name: "kind", type: "string", required: false, description: "Tür: system (varsayılan), window, region" },
      { name: "selector", type: "string", required: false, description: "Bölge seçici (opsiyonel)" },
      { name: "format", type: "string", required: false, description: "Format: png (varsayılan), jpg" },
    ],
    examples: [
      { code: '++cmd:ScreenshotManager()', description: "Tüm ekranın görüntüsünü al" },
      { code: '++cmd:ScreenshotManager(system)', description: "Sistem ekran görüntüsü" },
      { code: '++cmd:ScreenshotManager(window, , png)', description: "Pencere görüntüsü PNG formatında" },
    ],
  },

  TakeScreenshot: {
    name: "TakeScreenshot",
    description: "ScreenshotManager için kısayol. Hızlıca ekran görüntüsü alır.",
    parameters: [],
    examples: [
      { code: '++cmd:TakeScreenshot()', description: "Hızlı ekran görüntüsü al" },
    ],
  },

  PlayMusic: {
    name: "PlayMusic",
    description: "Müzik çalma komutu. Sistem ses çalarını kontrol eder.",
    parameters: [
      { name: "genre", type: "string", required: false, description: "Müzik türü veya playlist adı" },
    ],
    examples: [
      { code: '++cmd:PlayMusic()', description: "Varsayılan müziği çal" },
      { code: '++cmd:PlayMusic(classic)', description: "Klasik müzik çal" },
      { code: '++cmd:PlayMusic(jazz)', description: "Jazz müzik çal" },
    ],
  },

  Restart: {
    name: "Restart",
    description: "Uygulamayı yeniden başlatır. Tüm oturumlar kapatılır ve uygulama yeniden açılır.",
    parameters: [],
    examples: [
      { code: '++cmd:Restart()', description: "Uygulamayı yeniden başlat" },
    ],
  },

  AIAIChatStart: {
    name: "AIAIChatStart",
    description: "AI-AI sohbetini başlatır. İki AI arasında otomatik konuşma başlar.",
    parameters: [
      { name: "topic", type: "string", required: false, description: "Konuşma konusu (opsiyonel)" },
    ],
    examples: [
      { code: '++cmd:AIAIChatStart()', description: "AI-AI sohbetini başlat" },
      { code: '++cmd:AIAIChatStart("Yapay zeka etiği")', description: "Belirli bir konuda AI-AI sohbeti" },
    ],
  },

  AIAIChatStop: {
    name: "AIAIChatStop",
    description: "AI-AI sohbetini durdurur. Devam eden otomatik konuşmayı sonlandırır.",
    parameters: [],
    examples: [
      { code: '++cmd:AIAIChatStop()', description: "AI-AI sohbetini durdur" },
    ],
  },

  GetFile: {
    name: "GetFile",
    description: "Belirtilen dosyayı okur ve içeriğini döndürür.",
    parameters: [
      { name: "path", type: "string", required: true, description: "Okunacak dosya yolu" },
    ],
    examples: [
      { code: '++cmd:GetFile(./package.json)', description: "package.json dosyasını oku" },
      { code: '++cmd:GetFile(./src/index.html)', description: "index.html dosyasını oku" },
    ],
  },

  GetItDone: {
    name: "GetItDone",
    description: "Genel amaçlı görev tamamlama komutu. AI'ya bir görevi tamamlamasını söyler.",
    parameters: [
      { name: "task", type: "string", required: true, description: "Yapılacak görev açıklaması" },
    ],
    examples: [
      { code: '++cmd:GetItDone("Kodu formatla")', description: "Kod formatlama görevi" },
      { code: '++cmd:GetItDone("Test yaz")', description: "Test yazma görevi" },
    ],
  },

  ListFiles: {
    name: "ListFiles",
    description: "Belirtilen klasördeki dosyaları listeler.",
    parameters: [
      { name: "path", type: "string", required: false, description: "Klasör yolu (varsayılan: mevcut dizin)" },
    ],
    examples: [
      { code: '++cmd:ListFiles()', description: "Mevcut dizindeki dosyaları listele" },
      { code: '++cmd:ListFiles(./src)', description: "src klasöründeki dosyaları listele" },
    ],
  },
};

/**
 * Komut kılavuzunu formatlanmış metin olarak döndürür
 * @param {string} commandName - Komut adı
 * @returns {string} - Formatlanmış kılavuz metni
 */
export function getCommandGuideText(commandName) {
  const guide = COMMAND_GUIDES[commandName];
  if (!guide) {
    return `"${commandName}" komutu için kılavuz bulunamadı.`;
  }

  let text = `📌 ${guide.name}\n`;
  text += `${"─".repeat(40)}\n\n`;
  text += `📝 Açıklama:\n${guide.description}\n\n`;

  if (guide.parameters && guide.parameters.length > 0) {
    text += `📋 Parametreler:\n`;
    guide.parameters.forEach((p) => {
      const req = p.required ? "(zorunlu)" : "(opsiyonel)";
      text += `  • ${p.name} [${p.type}] ${req}\n    ${p.description}\n`;
    });
    text += `\n`;
  }

  if (guide.examples && guide.examples.length > 0) {
    text += `💡 Örnek Kullanım:\n`;
    guide.examples.forEach((ex, i) => {
      text += `  ${i + 1}. ${ex.description}\n`;
      text += `     ${ex.code}\n`;
    });
  }

  return text;
}

/**
 * Tüm komut adlarını döndürür
 * @returns {string[]}
 */
export function getCommandList() {
  return Object.keys(COMMAND_GUIDES);
}
