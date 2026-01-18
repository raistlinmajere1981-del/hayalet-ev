# Hayalet-ev Project Context
> Auto-generated: 2026-01-17 | Regenerate: `npm run bootstrap`

## 📦 Proje Bilgisi
- **Ad:** hayalet-ev v5.4.0
- **Branch:** master
- **Uncommitted:** Yok ✓

## 📊 Yapı Özeti
- `src/js/modules/`: 0 dosya, 0 satır
- `src/js/pages/`: 0 dosya, 0 satır
- `electron/`: 2 dosya, 552 satır
- `mcp-server/`: 0 dosya, 0 satır

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
- mcp-server/node_modules/esbuild/install.js
- mcp-server/node_modules/esbuild/lib/main.js
- mcp-server/node_modules/ws/index.js
- mcp-server/node_modules/ws/lib/websocket-server.js
- mcp-server/node_modules/ws/lib/constants.js
- mcp-server/node_modules/ws/lib/buffer-util.js
- mcp-server/node_modules/ws/lib/validation.js
- mcp-server/node_modules/ws/lib/extension.js
- mcp-server/node_modules/ws/lib/stream.js
- mcp-server/node_modules/ws/lib/limiter.js

## 🔄 Son Commit'ler
- b642838 docs: AGENTS.md sadeleştirildi (524 → 228 satır)
- d9095b0 refactor(mcp): Provider yönetim komutları kaldırıldı
- 19d898d docs: TypeScript bölümünü güncelle - dönüşüm tamamlandı
- 16c62df feat(typescript): MCP Server strict mode aktif edildi
- da5e5d6 feat(typescript): Faz 6-7 tamamlandı - strictNullChecks + strict: true

## 📚 Detaylı Rehberler
- `AGENTS.md` - Ana geliştirme rehberi
- `.rovodev/cdp.md` - CDP tool'ları
- `.rovodev/logging.md` - Log sistemi
- `.rovodev/testing.md` - Test workflow'ları

---
*Bu dosya `npm run bootstrap` ile otomatik üretilir. Manuel düzenleme yapmayın.*
