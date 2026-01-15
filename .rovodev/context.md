# Hayalet-ev Project Context
> Auto-generated: 2026-01-15 | Regenerate: `npm run bootstrap`

## 📦 Proje Bilgisi
- **Ad:** hayalet-ev v5.4.0
- **Branch:** master
- **Uncommitted:** 8 dosya

## 📊 Yapı Özeti
- `src/js/modules/`: 77 dosya, 9,922 satır
- `src/js/pages/`: 15 dosya, 3,138 satır
- `electron/`: 25 dosya, 4,750 satır
- `mcp-server/`: 9 dosya, 1,712 satır

## 🗺️ Modül Haritası

### Orchestrator'lar
- core-engine.js - Ana koordinatör, tüm modülleri bağlar
- webview-manager.js - Webview lifecycle ve messaging
- traffic-manager.js - Loading/thinking state tracking
- relay-manager.js - AI↔AI ve AI↔Asistan iletişimi
- slot-controller.js - Slot yaşam döngüsü

### Veri Yönetimi
- database/ - SQLite (konuşma, mesaj, attachment)
- settings-manager.js - JSON config yönetimi
- app-state.js - Global runtime state

### AI Providers
- providers/chatgpt/ - ChatGPT entegrasyonu
- providers/grok/ - Grok entegrasyonu
- providers/gemini/ - Gemini entegrasyonu
- providers/opencode/ - Asistan (lokal server)

### Electron
- main.js - Ana process, IPC handlers
- preload.cjs - contextBridge API
- console-logger.js - Log sistemi

## ⚡ Kritik Kurallar
- ❌ console.log kullanma → LogManager.addEvent() kullan
- ✅ Her error log'a context ekle (provider, url, selector)
- ✅ Büyük dosyalarda edit-lines.js kullan
- ✅ Test sonrası logs/ klasörünü kontrol et
- ✅ executeJavaScript içi console.error kabul edilir (webview context)

## 🛠️ Sık Kullanılan Komutlar

**Geliştirme:**
- `npm start - Uygulamayı başlat`
- `npm run lint - Kod kontrolü`
- `npm run pre-commit - Commit öncesi kontrol`

**Analiz:**
- `npm run analyze -- --summary - Hızlı proje özeti`
- `npm run lint:unused - Kullanılmayan export'lar`
- `npm run diagram:simple - Modül bağımlılık diagramı`

**Test:**
- `npm run test:smoke - Smoke test (Electron çalışırken)`
- `check_electron_connection - CDP bağlantı kontrolü`
- `inspect_element --selector "..." - Element inceleme`

**Yardımcı:**
- `npm run edit-lines -- DOSYA --show SATIR1 SATIR2`
- `npm run bootstrap - Bu context dosyasını yenile`

## 📝 Son Değişen Dosyalar (7 gün)
- src/js/app.js
- src/js/constants/index.js
- src/js/constants/slots.js
- src/js/constants/events.js
- src/js/constants/file-utils.js
- src/js/constants/timeouts.js
- src/js/constants/ipc-channels.js
- src/js/modules/traffic-manager.js
- src/js/modules/slot/settings-sync.js
- src/js/modules/slot/index.js

## 🔄 Son Commit'ler
- 366304f feat: Proje analiz ve diagram araçları eklendi
- 1e7e76b feat: AI agent geliştirme araçları eklendi
- 2adeadc chore: .rovodev/AGENTS.md silindi - içerik kök AGENTS.md'de mevcut
- 6908358 docs: AGENTS.md hiyerarşik yapıya geçiş ve AI agent talimatları
- 083a343 refactor: console.log'ları LogManager'a entegre et

## 📚 Detaylı Rehberler
- `AGENTS.md` - Ana geliştirme rehberi
- `.rovodev/cdp.md` - CDP tool'ları
- `.rovodev/logging.md` - Log sistemi
- `.rovodev/testing.md` - Test workflow'ları

---
*Bu dosya `npm run bootstrap` ile otomatik üretilir. Manuel düzenleme yapmayın.*
