# 👻 Hayalet Ev

> AI'lar ve insanlar için kolektif zihin platformu

Hayalet-ev, aynı anda birden fazla AI sağlayıcısı ile çalışabilen, AI↔AI konuşmaları ve zamanlı otomasyonlar kurabilen Electron tabanlı bir masaüstü platformudur. İki AI slotu üzerinden hesap atayıp, analiz sayfasında üçlü sohbet, AI↔AI ve AI↔Asistan relayleri ve sistem komutlarıyla bilgisayar kontrolü akışlarını destekler.

---

## 🌟 Temel Özellikler

- 🤖 **Çift Slot AI Yönetimi:** 2 AI slotuna hesap bazlı provider atama
- 💬 **3'lü Sohbet:** Kullanıcı + 2 AI ile aynı anda analiz sohbeti
- 🔁 **AI↔AI ve AI↔Asistan Relay:** İki AI ve ROVO'ler arasında doğrudan konuşma akışı
- ⏱️ **Fısıltı Sistemi:** Zamanlı hatırlatma / otomatik mesaj tetikleme
- 🖥️ **Sistem Komutları:** Sunucu sayfası üzerinden AI'ye bilgisayar kontrolü devri
- 🧩 **Asistan Entegrasyonu:** CLI asistanlarla native ve web arayüzde iletişim
- 🌐 **Web Asistan UI:** Basit relay arayüzü
- 📦 **Arşivleme:** Konuşmalar otomatik arşivlenir, Drive senkronizasyonu destekler
- 🔧 **MCP Tool Suite:** fs/dev/cdp/git/web araçları
- 🎨 **UI Message Box:** Görsel mesaj kutuları (echo'dan %70 daha verimli)
- 🛡️ **3-Layer Validation:** Prettier + jscodeshift + Babel AST

---

## 🧭 Sayfalar ve Akışlar

### Entrance

- Slotlar, hesaplar ve provider atamaları
- Temel kullanıcı oturumu yönetimi

### Analyze

- Kullanıcı + 2 AI ile üçlü sohbet
- AI↔AI relay ve protokol tabanlı sohbet akışı

### Asistan

- Sistem CLI asistanlarıyla web üzerinden iletişim (relay tabanlı)

### Whisper

- Zamanlı mesaj tetikleme ve otomatik iletişim başlatma

### Server

- Bağlı AI’ye sistem komutları ile kontrol devri

---

## 🏗️ Mimari Özet

```
Main Process (electron/main.ts)
├── Renderer (src/index.html → CoreEngine)
├── AI Provider Webviews (isolated)
└── IPC Bridge (preload.cjs)
```

---

## 🧩 Sağlayıcılar (Providers)

- ChatGPT
- Gemini
- Grok
- OpenCode

---

### Katmanlar

- **Main Process:** Device, Whisper, Settings, Database, Logger yönetimi
- **Renderer:** UI, state yönetimi, webview koordinasyonu, traffic tracking
- **Webviews:** Provider bazlı izolasyon (ChatGPT, Gemini, Grok, OpenCode)
- **MCP Server:** Local toollar ile geliştirme desteği

## 🛠️ Kurulum ve Çalıştırma

```bash
# bağımlılıkları yükle
npm install

# geliştirme modu
npm run dev

# production build
npm run build
```

### Sık Kullanılan Komutlar

```bash
npm start
npm run lint
npm run check-types
npm run check
```

---

## 📦 Versiyon Bilgileri

> **Güncel versiyon ve tool sayıları:** `.rovo/_metadata/VERSION-INFO.md` (otomatik güncellenir)

**Ana Bileşenler:**

- Hayalet-ev: 5.4.0
- MCP Server: 3.0.0
- Electron: 40+
- Node.js: 22.22.0 (ESM)
- TypeScript: 5.x (strict)

---

## 🔧 MCP Tool Suite

Hayalet-ev'in kendi MCP sunucusu, geliştirme için özel olarak tasarlanmış kapsamlı araçlar sunar:

**Tool Kategorileri:**

- **Development** (`hev_dev_*`) - TypeScript fix, ESLint, AST, refactor, codemod
- **CDP/Electron** - Screenshot, click, inspect, automation
- **Git Operations** (`hev_git_*`) - Fork, PR, guidelines check
- **Workflows** (`hev_run_*`) - Predefined test flows
- **Logging** - Session management, streaming, analysis
- **Context** (`hev_context_*`) - Project context generation (Repomix)

**Validation Stack:** Prettier + jscodeshift + Babel AST

> **Güncel tool listesi:** `.rovo/_metadata/TOOL-LIST.md`  
> **Tool sayısı ve versiyonlar:** `.rovo/_metadata/VERSION-INFO.md`

---

## 📚 Geliştirme Rehberi

- **Geliştirici kuralları:** `AGENTS.md`
- **Başlangıç rehberi:** `.rovo/00-ONBOARDING.md`
- **Core protocol:** `.rovo/01-CORE-PROTOCOL.md`
- **MCP essentials:** `.rovo/02-MCP-ESSENTIALS.md`
- **Mimari detaylar:** `.rovo/03-ARCHITECTURE.md`

---

## 🤝 Katkıda Bulunma

Katkılar memnuniyetle karşılanır. Lütfen geliştirme standartları için `AGENTS.md` dosyasını takip edin.

---

## 📝 Lisans

MIT License

---

**Yapımcı:** Raistlin Majere  
**Proje Başlangıç:** 2025
