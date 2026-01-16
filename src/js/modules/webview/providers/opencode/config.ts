/**
 * OpenCode Provider Configuration
 * 
 * OpenCode - AI asistan arayüzü (lokal server)
 * doc/opencode.txt dosyasından alınan selector bilgileri
 * 
 * OpenCode serve komutu ile başlatılır:
 * opencode serve --port 4096 --cors http://localhost:5173
 */

// Server default değerleri
export const OPENCODE_DEFAULTS = {
  port: 4096,
  cors: "http://localhost:5173",
  command: "opencode",
};

export const config = {
  id: "opencode",
  name: "OpenCode",
  
  // Lokal server URL'i (opencode serve ile başlatılır)
  baseUrl: `http://localhost:${OPENCODE_DEFAULTS.port}`,
  port: OPENCODE_DEFAULTS.port,
  cors: OPENCODE_DEFAULTS.cors,
  command: OPENCODE_DEFAULTS.command,
  
  // Web sitesi değil, lokal server kullanıyoruz
  loginUrl: null,
  lastVerified: "2026-01-14",
  
  // Asistan provider olduğunu belirt
  isAsistan: true,
  
  /**
   * Proje klasörü ile URL oluştur
   * @param {string|null} projectPath - Proje klasörü yolu (opsiyonel)
   * @param {number} port - Server portu (opsiyonel)
   * @returns {string} Tam URL
   */
  getProjectUrl(projectPath = null, port = OPENCODE_DEFAULTS.port) {
    const baseUrl = `http://localhost:${port}`;
    if (projectPath) {
      return `${baseUrl}?project=${encodeURIComponent(projectPath)}`;
    }
    return baseUrl;
  },
  
  /**
   * Server komutunu oluştur
   * @param {number} port - Server portu
   * @param {string} cors - CORS origin
   * @returns {object} Komut ve argümanları
   */
  getServerCommand(port = OPENCODE_DEFAULTS.port, cors = OPENCODE_DEFAULTS.cors) {
    return {
      command: OPENCODE_DEFAULTS.command,
      args: ["serve", "--port", String(port), "--cors", cors],
    };
  },
  
  selectors: {
    // Gönder butonu base selector (aktif veya pasif - disabled kontrolü probe script'te yapılır)
    // <button type="submit" icon="arrow-up" data-component="icon-button">
    sendButtonBase: 'button[type="submit"][icon="arrow-up"][data-component="icon-button"]',
    
    // Aktif gönder butonu - disabled attribute YOK
    // <button type="submit" icon="arrow-up" data-component="icon-button" data-variant="primary">
    sendButton: 'button[type="submit"][icon="arrow-up"][data-component="icon-button"]:not([disabled])',
    
    // Pasif gönder butonu - disabled attribute VAR
    // <button type="submit" disabled="" icon="arrow-up" data-component="icon-button">
    sendButtonDisabled: 'button[type="submit"][icon="arrow-up"][data-component="icon-button"][disabled]',
    
    // Stop butonu (thinking durumunda görünür)
    // <button type="submit" icon="stop" data-component="icon-button">
    stopButton: 'button[type="submit"][icon="stop"][data-component="icon-button"]',
    
    // Metin giriş alanı (contenteditable div)
    // <div data-component="prompt-input" contenteditable="true">
    inputField: '[data-component="prompt-input"][contenteditable="true"]',
    
    // Mesaj container
    messageContainer: '[data-slot="session-turn-message-content"]',
    
    // Kullanıcı mesaj alanı
    // <div data-slot="user-message-text"><span>mesaj</span></div>
    userMessage: '[data-slot="user-message-text"]',
    
    // Asistan cevap alanı (markdown içeriği)
    // <div data-component="markdown" data-slot="session-turn-markdown">
    assistantMessage: '[data-slot="session-turn-markdown"][data-component="markdown"]',
    
    // Alternatif asistan cevap selector'ü
    assistantMessageAlt: '[data-slot="session-turn-summary-section"] [data-component="markdown"]',
    
    // Ses butonu (varsa)
    voiceButton: "",
    
    // File preview selectors
    filePreview: [
      '[data-type="file"]',
      '[data-component="file-attachment"]',
    ],
  },

  // Input type: contenteditable div
  inputType: "contenteditable",
  
  scrollerSelectors: [
    '[data-component="session-view"]',
    '[data-slot="session-content"]',
    '.overflow-y-auto',
    'main .overflow-auto',
  ],
  
  scrapeSelectors: {
    // Kullanıcı mesajları
    userMessage: '[data-slot="user-message-text"]',
    // Asistan mesajları
    assistantMessage: '[data-slot="session-turn-markdown"]',
    // Fallback
    fallback: '[data-component="user-message"], [data-component="markdown"]',
  },
  
  fileInputSelectors: [
    'input[type="file"]',
  ],
  
  uploadTargetSelectors: [
    '[data-component="prompt-input"]',
    '[data-slot="prompt-input-container"]',
  ],
  
  criticalSelectors: [
    '[data-component="prompt-input"]',
    'button[type="submit"][data-component="icon-button"]',
  ],
  
  contentContainers: ["div", "section", "article"],
  
  filters: {
    selectors: [],
    hosts: [],
    blockResourceTypes: [],
    dragOverlaySelectors: [
      '[data-dnd-overlay]',
      '.drag-overlay',
    ],
    dragTextMatchers: [
      "drop",
      "dosya",
      "file",
    ],
  },
  
  // Hariç tutulan URL'ler (lokal server için geçerli değil)
  excludedUrls: [],

  telemetry: {
    endpoints: [],
    tokenPaths: [],
  },
};
