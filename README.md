# 👻 Hayalet Ev

> AI'lar ve insanlar için kolektif zihin platformu

Hayalet-ev, aynı anda birden fazla AI sağlayıcısı ile çalışabilen, AI↔AI konuşmaları ve zamanlı otomasyonlar kurabilen Electron tabanlı bir masaüstü platformudur. İki AI slotu üzerinden hesap atayıp, analiz sayfasında üçlü sohbet, AI↔AI ve AI↔Asistan relayleri ve sistem komutlarıyla bilgisayar kontrolü akışlarını destekler.

---

## 🌟 Temel Özellikler

- 🤖 **Çift Slot AI Yönetimi:** 2 AI slotuna hesap bazlı provider atama
- 💬 **3'lü Sohbet:** Kullanıcı + 2 AI ile aynı anda analiz sohbeti
- 🔁 **AI↔AI ve AI↔Asistan Relay:** İki AI ve Asistan AI'ler arasında doğrudan konuşma akışı
- ⏱️ **Fısıltı Sistemi:** Zamanlı hatırlatma / otomatik mesaj tetikleme
- 🖥️ **Sistem Komutları:** Sunucu sayfası üzerinden AI’ye bilgisayar kontrolü devri
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
- Bağlı AI’ye sistem komutları ile kontrol devri

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
npm start
npm run lint
npm run check-types
npm run check
```

---

## 📚 Geliştirme Rehberi

- **Geliştirici kuralları:** `AGENTS.md`
- **Mod tetikleyicileri:** `.rovodev/auto-triggers.md`
- **Mimari detaylar:** `.rovodev/architecture.md`
- **Konseptler:** `.rovodev/concepts.md`
- **Log sistemi:** `.rovodev/logging.md`

---

## 🤝 Katkıda Bulunma

Katkılar memnuniyetle karşılanır. Lütfen geliştirme standartları için `AGENTS.md` dosyasını takip edin.

---

## 📝 Lisans

MIT License

---

**Yapımcı:** Raistlin Majere  
**Proje Başlangıç:** 2025
