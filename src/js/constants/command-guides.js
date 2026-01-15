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
    description: `Fısıltı (whisper) mesajları yönetir. AI'lara zamanlı hatırlatmalar ve gizli notlar ekler.

⏰ ALARM SİSTEMİ: when parametresi ile gelecekteki bir zamana mesaj planlanabilir.
Sistem her dakika kontrol yapar ve zamanı gelen mesajları otomatik olarak hedef AI'ya gönderir.`,
    parameters: [
      { name: "user", type: "string", required: true, description: "Hedef: ai1, ai2 veya nickname" },
      { name: "text", type: "string", required: true, description: "Fısıltı/hatırlatma mesajı içeriği" },
      { name: "when", type: "string", required: false, description: `Tetiklenme zamanı. Formatlar:
    • Boş veya "" → Hemen tetiklenir
    • "15.01.2026 14:30" → Türkçe format (GG.AA.YYYY SS:DD)
    • "15/01/2026 14:30" → Alternatif format (GG/AA/YYYY SS:DD)
    • "2026-01-15T14:30:00" → ISO format
    • 1736945400000 → Unix timestamp (milisaniye)` },
    ],
    examples: [
      { code: '++cmd:WhisperManager("ai1", "Merhaba, nasılsın?", "")', description: "AI1'e hemen mesaj gönder" },
      { code: '++cmd:WhisperManager("ai1", "Toplantı başlıyor!", "15.01.2026 14:00")', description: "15 Ocak 14:00'te AI1'e hatırlatma" },
      { code: '++cmd:WhisperManager("ai2", "Raporu gönder", "15/01/2026 09:30")', description: "Sabah 09:30'da AI2'ye hatırlatma" },
      { code: '++cmd:WhisperManager("ai1", "Günaydın!", "2026-01-16T08:00:00")', description: "ISO format ile zamanlama" },
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

  AIAsistanChatStart: {
    name: "AIAsistanChatStart",
    description: `AI-Asistan relay oturumunu başlatır.

Belirtilen AI (ai1 veya ai2) ile Asistan (AI0/OpenCode) arasında otomatik mesaj iletimi başlatır.
Protokol dosyası (protocol/AI-asistan.txt) AI'ye gönderilir ve relay aktif olur.

Akış:
1. Protokol AI'ye gönderilir
2. AI cevap verir → Asistan'a iletilir
3. Asistan cevap verir → AI'ye iletilir
4. Döngü devam eder (AIAsistanChatStop ile durdurulana kadar)`,
    parameters: [
      { name: "sourceSlot", type: "string", required: false, description: "Kaynak AI slotu: ai1 (varsayılan) veya ai2" },
    ],
    examples: [
      { code: '++cmd:AIAsistanChatStart()', description: "AI1 ile Asistan arasında relay başlat" },
      { code: '++cmd:AIAsistanChatStart(ai1)', description: "AI1 ↔ Asistan relay" },
      { code: '++cmd:AIAsistanChatStart(ai2)', description: "AI2 ↔ Asistan relay" },
    ],
  },

  AIAsistanChatStop: {
    name: "AIAsistanChatStop",
    description: `AI-Asistan relay oturumunu durdurur. 

AI ve Asistan (AI0/OpenCode) arasındaki otomatik mesaj iletimini sonlandırır.
Bu komut genellikle AI tarafından oturumu bitirmek istediğinde kullanılır.`,
    parameters: [],
    examples: [
      { code: '++cmd:AIAsistanChatStop()', description: "AI-Asistan relay'ini durdur" },
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

  // ============================================
  // Meta Komutlar - Dinamik Komut Tanımlama
  // ============================================

  DefineCommand: {
    name: "DefineCommand",
    description: `Yeni bir custom komut tanımlar. Komutlar kalıcı olarak kaydedilir ve uygulama yeniden başlatıldığında da kullanılabilir.

⚠️ TAM YETKİ: Kod sistem düzeyinde çalışır, güvenlik kısıtlaması yoktur.

Kod içinde kullanılabilir context:
• context.LogManager - Log sistemi
• context.AppState - Uygulama durumu
• context.TrafficManager - AI durumları
• context.SlotController - Slot yönetimi
• context.WebviewManager - Webview kontrolü
• context.RelayManager - Relay yönetimi
• context.delay(ms) - Bekleme fonksiyonu
• context.log(msg) - Kısa log fonksiyonu
• context.error(msg) - Hata log fonksiyonu
• args - Komut argümanları (array)`,
    parameters: [
      { name: "name", type: "string", required: true, description: "Komut adı (PascalCase önerilir)" },
      { name: "description", type: "string", required: true, description: "Komut açıklaması (çift tırnak içinde)" },
      { name: "code", type: "string", required: true, description: "JavaScript kodu (backtick içinde)" },
    ],
    examples: [
      { 
        code: '++cmd:DefineCommand(Merhaba, "Selamlama komutu", `context.log("Merhaba " + (args[0] || "Dünya")); return { success: true, message: "Selamlandı!" };`)', 
        description: "Basit selamlama komutu" 
      },
      { 
        code: '++cmd:DefineCommand(BekleVeLogla, "Bekleyip log atar", `await context.delay(1000); context.log("1 saniye geçti!"); return { success: true };`)', 
        description: "Async bekleme komutu" 
      },
      { 
        code: '++cmd:DefineCommand(SlotDurumu, "AI slot durumlarını gösterir", `const state = context.AppState.getState(); context.log(JSON.stringify(state.slots)); return { success: true, slots: state.slots };`)', 
        description: "Slot durumunu sorgulama" 
      },
    ],
  },

  DeleteCommand: {
    name: "DeleteCommand",
    description: "Tanımlı bir custom komutu siler. Sistem komutları silinemez.",
    parameters: [
      { name: "name", type: "string", required: true, description: "Silinecek komut adı" },
    ],
    examples: [
      { code: '++cmd:DeleteCommand(Merhaba)', description: "Merhaba komutunu sil" },
      { code: '++cmd:DeleteCommand(BekleVeLogla)', description: "BekleVeLogla komutunu sil" },
    ],
  },

  ListCustomCommands: {
    name: "ListCustomCommands",
    description: "Tanımlı tüm custom komutları listeler. Her komutun adı, açıklaması ve oluşturulma bilgisi gösterilir.",
    parameters: [],
    examples: [
      { code: '++cmd:ListCustomCommands()', description: "Tüm custom komutları listele" },
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
