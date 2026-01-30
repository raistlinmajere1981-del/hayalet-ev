# 👻 Hayalet Ev

> AI'lar ve insanlar için kolektif zihin platformu

Hayalet-ev, aynı anda birden fazla AI sağlayıcısı ile çalışabilen, AI↔AI konuşmaları ve zamanlı otomasyonlar kurabilen Electron tabanlı bir masaüstü platformudur. İki AI slotu üzerinden hesap atayıp, analiz sayfasında üçlü sohbet, AI↔AI ve AI↔Asistan relayleri ve sistem komutlarıyla bilgisayar kontrolü akışlarını destekler.

---

## 🚀 Quick Start (5 Dakikada Başla)

Yeni sistemle hızlıca başlamak için:

1. **📖 Quick Start:** [`.rovo/00-QUICK-START.md`](.rovo/00-QUICK-START.md) - 5 dakikada başla
2. **📋 Ana Rehber:** [`.rovo/01-AGENTS.md`](.rovo/01-AGENTS.md) - Geliştirme kuralları
3. **🎭 Atlas:** [`.rovo/02-ATLAS-ORCHESTRATION.md`](.rovo/02-ATLAS-ORCHESTRATION.md) - Orchestration sistemi

```bash
# Health check
npm start

# Generate docs
npm run generate:docs
```

---

## 🌟 Temel Özellikler

- 🤖 **Çift Slot AI Yönetimi:** 2 AI slotuna hesap bazlı provider atama
- 💬 **3'lü Sohbet:** Kullanıcı + 2 AI ile aynı anda analiz sohbeti
- 🔁 **AI↔AI ve AI↔Asistan Relay:** İki AI ve ROVO'ler arasında doğrudan konuşma akışı
- ⏱️ **Fısıltı Sistemi:** Zamanlı hatırlatma / otomatik mesaj tetikleme
- 🖥️ **Sistem Komutları:** Sunucu sayfası üzerinden AI'ye bilgisayar kontrolü devri
- 🧩 **Asistan Entegrasyonu:** CLI asistanlarla native ve web arayüzde iletişim
- 🌐 **Web Asistan UI:** Basit relay arayüzü
- 🧠 **Native Asistan UI:** CodeNomad v0.9.0 (OpenCode tabanlı) gelişmiş arayüz
- 📦 **Arşivleme:** Konuşmalar otomatik arşivlenir, Drive senkronizasyonu destekler

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

### Asistan Native

- CodeNomad v0.9.0 arayüzü ile gelişmiş native asistan deneyimi

### Whisper

- Zamanlı mesaj tetikleme ve otomatik iletişim başlatma

### Server

- Bağlı AI'ye sistem komutları ile kontrol devri

---

## 🏗️ Mimari Özet

```
Main Process (electron/main.ts)
├── Renderer (src/index.html → CoreEngine)
├── AI Provider Webviews (isolated)
└── IPC Bridge (preload.cjs)
```

- **Main Process:** Device, Whisper, Settings, Database yönetimi
- **Renderer:** UI, state yönetimi, webview koordinasyonu
- **Webviews:** Provider bazlı izolasyon (ChatGPT, Gemini, Grok, OpenCode)

---

## 🧩 Sağlayıcılar (Providers)

- ChatGPT
- Gemini
- Grok
- OpenCode (Native/Relay)

> Provider selector ve DOM değişiklikleri sık gerçekleşir, değişiklik sonrası manuel test yapılmalıdır.

---

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
npm start                      # Uygulamayı başlat
npm run lint                   # ESLint kontrolü
npm run check-types            # TypeScript kontrolü
npm run check                  # Tüm kontroller
npm run generate:docs          # Dokümantasyon güncelle
```

---

## 📚 Dokümantasyon Sistemi (v2.0)

### 📖 Hiyerarşik Yapı

```
.rovo/
├── 00-QUICK-START.md                    # 🚀 5 dakikada başla
├── 01-AGENTS.md                         # 📋 Ana rehber (768 satır)
├── 02-ATLAS-ORCHESTRATION.md            # 🎭 Orchestration sistemi
├── guides/                              # Detaylı rehberler
│   ├── development/                     # 🛠️ Geliştirme
│   │   ├── 10-MCP-TOOLS.md             # MCP tool ekosistemi
│   │   └── 20-TYPESCRIPT-SUITE.md      # TS Helper Suite
│   ├── architecture/                   # 🏗️ Mimari
│   │   ├── 40-ARCHITECTURE.md          # Process architecture
│   │   └── 50-CONCEPTS.md              # Key concepts
│   ├── testing/                        # 🧪 Test & debugging
│   │   ├── 60-TESTING.md               # Testing workflows
│   │   └── 70-CDP.md                   # CDP usage
│   └── reference/                      # 📚 Referans materyalleri
│       ├── 80-AUTO-TRIGGERS.md         # Mod sistemi
│       ├── 81-PERSONA.md               # ROVO persona
│       ├── 82-LOGGING.md               # Log sistemi
│       ├── 83-CONTEXT-MANAGEMENT.md   # Session context
│       ├── 84-SAFE-EDITING.md          # Editing best practices
│       └── 85-NOTEBOOK.md              # 📓 Not defteri
└── _metadata/                          # 📦 Otomatik içerik
    ├── TOOL-LIST.md                    # Complete tool list
    ├── VERSION-INFO.md                 # Version bilgisi
    └── ROADMAP.md                      # Özellik roadmap
```

### 🔗 Dokümantasyon Rehberleri

| Amaç                      | Dosya                                                                                           | Okuma Süresi |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------ |
| **Hızlı Başlangıç**       | [00-QUICK-START.md](.rovo/00-QUICK-START.md)                                                 | 5 dk         |
| **Ana Geliştirme**        | [01-AGENTS.md](.rovo/01-AGENTS.md)                                                           | 15 dk        |
| **Orchestration Sistemi** | [02-ATLAS-ORCHESTRATION.md](.rovo/02-ATLAS-ORCHESTRATION.md)                                 | 20 dk        |
| **MCP Tool Ekosistemi**   | [guides/development/10-MCP-TOOLS.md](.rovo/guides/development/10-MCP-TOOLS.md)               | 15 dk        |
| **TypeScript Suite**      | [guides/development/20-TYPESCRIPT-SUITE.md](.rovo/guides/development/20-TYPESCRIPT-SUITE.md) | 20 dk        |
| **Mimari Detayları**      | [guides/architecture/40-ARCHITECTURE.md](.rovo/guides/architecture/40-ARCHITECTURE.md)       | 15 dk        |
| **Key Concepts**          | [guides/architecture/50-CONCEPTS.md](.rovo/guides/architecture/50-CONCEPTS.md)               | 20 dk        |
| **Auto-Generation**       | [npm run generate:docs](package.json)                                                           | 1 dk         |

### 🔧 Öne Çıkılan Rehberler

| Konu                      | Dosya                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Dil Politikası**        | [01-AGENTS.md#-1-dil-politikası-zorunlu](.rovo/01-AGENTS.md#-1-dil-politikası-zorunlu)                         |
| **MCP Tool Direktifi**    | [01-AGENTS.md#-3-mcp-tool-kullanım-direktifi-kritik](.rovo/01-AGENTS.md#-3-mcp-tool-kullanım-direktifi-kritik) |
| **TypeScript Suite**      | [01-AGENTS.md#-4-typescript-helper-suite-v1110](.rovo/01-AGENTS.md#-4-typescript-helper-suite-v1110)           |
| **Mod Sistemi**           | [01-AGENTS.md#-5-mod-sistemi](.rovo/01-AGENTS.md#-5-mod-sistemi)                                               |
| **Not Defteri Protokolü** | [01-AGENTS.md#141-not-defteri-protokolü-zorunlu](.rovo/01-AGENTS.md#141-not-defteri-protokolü-zorunlu)         |

---

## 🧙 ROVO'ler için Not Defteri

ROVO'ler, Hayalet-ev MCP tool'larını kullanırken karşılaştıkları hataları, geliştirme fikirlerini ve eklenebilecek yeni tool'ları **mutlaka** not defterine not almalıdır.

**Not Defteri Dosyası:** [guides/reference/85-NOTEBOOK.md](guides/reference/85-NOTEBOOK.md)

**Kategoriler:**

- 🚨 Hata Kayıtları (tool errors, syntax errors, runtime errors)
- 💡 Geliştirme Fikirleri (automation, workflow improvements, refactoring)
- 🔧 Yeni Tool Fikirleri (high, medium, low priority)

**Örnek Format:**

```markdown
## Hata Tarihi: 2026-01-30

**Komut:**
hev_dev_safe_batch_refactor({
file_path: "src/modules/event-handlers.ts",
operations: [...]
})

**Hata Mesajı:**
"Error count increased: 52 → 54"

**Sorun Tanımı:**
Replace string'i syntax hatası yaratmış.

**Önerilen Çözüm:**

1. Replace pattern'ını dry-run mode'da test et
2. hev_dev_check_syntax ile verify et
3. verify_after_each: true ile retry et

**Kategoriler:**
[tool-error, syntax-error]
```

---

## 🤝 Katkıda Bulunma

Katkılar memnuniyetle karşılanır. Lütfen geliştirme standartları için [`.rovo/01-AGENTS.md`](.rovo/01-AGENTS.md) dosyasını takip edin.

---

## 📝 Lisans

MIT License

---

**Yapımcı:** Raistlin Majere  
**Proje Başlangıç:** 2025  
**Sürüm:** 5.4.0  
**Dokümantasyon:** v2.0
