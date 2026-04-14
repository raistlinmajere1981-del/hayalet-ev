# Hayalet Ev

Hayalet Ev, Electron + TypeScript ile geliştirilen local-first bir çok-ajan çalışma ortamıdır. Kullanıcıyı, AI slotlarını, room package mimarisini ve yerel araç kullanımını aynı masaüstü uygulamasında buluşturur.

Bugünkü repo yüzeyi artık yalnızca genel bir "çoklu AI sohbet" kabuğu değildir. Proje; scene/classic UI modları, install edilebilir room paketleri, OpenCode tabanlı `AI0` assistant, email tabanlı `US1` relay, arşiv/protokol yönetimi ve yerleşik MCP araçlarıyla çalışan daha geniş bir runtime sunar.

## Mevcut Ürün Yüzeyi

### Ana sayfalar

| Sayfa | Bugünkü rolü |
| --- | --- |
| `Entrance` | `AI1` ve `AI2` slotlarına provider/account bağlama, webview readiness, test ve sync akışı |
| `Analyze` | Kullanıcı + `AI1` + `AI2` + `US1` için ortak çalışma alanı; mesajlaşma, attachment akışı ve room bundle import yüzeyi |
| `Rooms` | Kurulu odaların listelendiği corridor/sahne görünümü ve room launch noktası |
| `Room Page` | Seçilen room'un immersive runtime yüzeyi; room UI ve host birlikte çalışır |
| `Assistant` | `AI0` için OpenCode / OpenCode UI tabanlı assistant yüzeyi, runtime durum takibi ve memory overlay |
| `Archives` | Arama yapılabilen konuşma arşivi, başlık/özet düzenleme ve protocol editor |
| `Settings` | Hesaplar, kullanıcı/US1, dil, tema, room manager, backup ve live log panelleri |
| `Server` | `AI1-AI2`, `AI0` ve `US1` için komut kataloğu, test argümanı girişi ve timeline/log görünümü |
| `Whisper` | `AI1` ve `AI2` için zamanlanmış kısa not/prompt kuyruğu |

### Slot modeli

- `AI1` ve `AI2` ana webview slotlarıdır; repo içinde `ChatGPT`, `Gemini` ve `Grok` provider konfigürasyonları bulunur.
- `AI0` assistant slotudur; bugün `OpenCode` ve `OpenCode UI` adapter'ları ile çalışır.
- `US1` email/relay tabanlı uzak Hayalet Ev kullanıcısıdır.
- Yerel kullanıcı scene ve room yüzeylerinde sabit katılımcıdır.

## Room Mimarisi

Hayalet Ev'in asıl ürünleşmiş yüzeyi artık room package sistemi üzerinden ilerler. Room source kodu `rooms/<room-id>` altında tutulur, kurulu kopyalar `data/rooms/<room-id>` altına alınır, mutable runtime verileri `data/room-storage/<room-id>` altında yaşar ve paketler `.hevroom.json` olarak içe/dışa aktarılabilir.

Settings içindeki room manager bugün şu akışları destekler:

- workspace room'ları listeleme
- kurulu room'ları listeleme
- workspace'ten install etme
- kurulu room'u kaldırma
- workspace/export/package işlemleri
- `.hevroom.json` bundle import etme

Bazı room mutasyonları tam uygulama yeniden başlatması isteyebilir.

### Repo içindeki first-party room'lar

| Room | Repo durumu | Ana fonksiyonlar | Not |
| --- | --- | --- | --- |
| `laboratory` | Şu an `config/rooms.json` içinde kurulu görünüyor | `media-analysis`, `audio-analysis`, `subtitle-analysis` | Kaynak alımı, readiness, processing ve reporting akışını tek bir workbench içinde toplar |
| `game-room` | Workspace room olarak repo içinde mevcut | `xox`, `team-tetris`, `fate-knots` | AI slotları ve `US1` ile oynanan etkileşimli room paketidir |

### `Laboratory`

- Guided workbench yaklaşımıyla çalışır.
- `media-analysis`: proje intake, readiness review, processing ve reporting için birleşik giriş.
- `audio-analysis`: ses odaklı kaynak hazırlığı, signal/speech toolchain'i ve raporlama akışı.
- `subtitle-analysis`: yerel subtitle intake, YouTube subtitle capture, cleanup, QC ve raporlama akışı.
- Room altında room-local tool manifestleri ve Python helper'ları da bulunur; tam analiz akışları kullanılan toolchain'e göre ek ortam hazırlığı gerektirebilir.

### `Game Room`

- `xox`: kullanıcıya karşı `AI1`, `AI2` veya `US1` ile üç-taş eşleşmeleri.
- `team-tetris`: kullanıcı + `AI1` + `AI2` + `US1` için dört koltuklu sıra tabanlı mod.
- `fate-knots`: ortak kararlar, deterministic AI companion davranışı ve tek encounter dilimine sahip story-combat skeleton.

## Assistant, MCP ve Çalışma Modları

### Assistant / `AI0`

- Assistant sayfası `OpenCode` veya `OpenCode UI` runtime'ını başlatıp uygulama içine bağlayabilir.
- OpenCode server lifecycle, port keşfi, health check ve session storage akışları Electron tarafında yönetilir.
- Assistant yüzeyi provider durumu, model tercihleri ve shared memory görünümü taşır.

### Yerleşik MCP sunucusu

- Proje kendi app MCP sunucusunu (`hev_*`) içerir.
- Tool yüzeyi dosya sistemi, TypeScript language service, lint/test, Electron/CDP debug, shared memory ve web fetch/search araçlarını kapsar.
- MCP metadata üretimi `npm run mcp:build` ile yenilenir.

### Wrapper ve mod sistemi

- Wrapper tabanlı başlangıç akışı `terminal`, `app` ve `ghost-agent` modlarını yönetir.
- Mod kontrolü için `npm run mode:status`, `npm run mode:switch`, `npm run mode:wait` ve `npm run whereami` script'leri bulunur.
- `ghost-agent` ayrı Electron runtime'ı olarak geliştirilebilir ve ana uygulamaya geri dönebilir.

### UI modları

- Uygulama hem classic hem scene UI modunu destekler.
- Scene modunda corridor/room yüzeyleri, immersive shell ve scene debug altyapısı devrededir.
- Scene debug akışı room hot spot'ları, theme/layout draft'leri ve scene editor yardımıyla geliştirilebilir.

## Teknoloji Yığını

- Electron
- Vite
- TypeScript (strict)
- SQLite / `better-sqlite3`
- libSQL tabanlı shared memory katmanı
- Model Context Protocol (MCP)
- Room tabanlı host/UI runtime ayrımı
- Email transport ve relay altyapısı
- Optional OpenCV destekli asset processing

## Dizin Yapısı

```text
src/           Renderer uygulaması, sayfalar, scene sistemi, modüller
electron/      Main process, IPC, room/package manager, OpenCode ve transport servisleri
ghost-agent/   Ayrı ghost-agent runtime'ı
mcp-server/    App MCP sunucusu
rooms/         Workspace room source tree
shared/        Ortak tipler, i18n, protokol ve yardımcı katmanlar
config/        Ayarlar, room registry ve diğer runtime config dosyaları
data/          Kurulu room kopyaları, runtime kontrolü ve mutable uygulama verileri
logs/          app / mcp-server / ghost-agent session logları
```

## Kurulum

### Gereksinimler

- Node.js `>= 22`
- npm `>= 10`

### Temel kurulum

```bash
npm install
```

`postinstall` sırasında Electron runtime'ı için `better-sqlite3` hazırlığı yapılır.

### Uygulamayı başlatma

Wrapper tabanlı tam akış için:

```bash
npm run start
```

Scene UI ile başlatmak için:

```bash
npm run start:scene
```

Sadece ghost runtime ile başlatmak için:

```bash
npm run start:ghost
```

### Doğrudan geliştirme akışı

`npm run dev` yalnızca Vite geliştirici sunucusunu açar. Tam Electron geliştirme akışı için aşağıdaki script'lerden biri kullanılmalıdır:

```bash
npm run electron:dev
npm run electron:dev:scene
npm run electron:dev:scene:debug
npm run electron:assistant:scene
```

### Assistant / OpenCode notu

Assistant tarafındaki `AI0` akışları için sistemde `opencode` komutunun erişilebilir olması beklenir. OpenCode entegrasyonu yoksa assistant sayfasındaki tanı ve kurulum akışı kullanılabilir.

### Opsiyonel OpenCV akışı

```bash
npm run opencv:install
npm run assets:process:opencv
```

## Geliştirme Komutları

### Kalite kontrolleri

```bash
npm run lint
npm run format:check
npm run typecheck
npm run check
npm run check:all
```

### Room odaklı kontroller

```bash
npm run rooms:build
npm run rooms:check
npm run rooms:test:core
npm run rooms:typecheck
npm run rooms:bundle
```

### MCP / metadata

```bash
npm run mcp:start
npm run mcp:check
npm run mcp:build
npm run generate:docs
```

### Paketleme

```bash
npm run build:all
npm run dist:linux
npm run dist:win
```

### Yardımcı smoke script'leri

```bash
npm run test:smoke
npm run mail:transport:smoke
npm run us1:relay:start
```

## Runtime Dosyaları ve Durum

- `config/settings.json`: uygulama, hesap, slot ve assistant ayarları
- `config/rooms.json`: kurulu room kayıtları
- `data/rooms/`: kurulu portable room kopyaları
- `data/room-storage/`: room bazlı mutable runtime state ve artefact'ler
- `data/assistant-runtime.json`: wrapper mod durumu
- `logs/app/`, `logs/mcp-server/`, `logs/ghost-agent/`: session bazlı loglar

## Dokümantasyon

- `AGENTS.md`: çalışma protokolü ve onay akışı
- `.rovo/00-ONBOARDING.md`: hızlı başlangıç ve temel kurallar
- `.rovo/01-CORE-PROTOCOL.md`: ROVO çalışma yaklaşımı
- `.rovo/03-ARCHITECTURE.md`: mimari, IPC, room package contract ve geliştirme script'leri

## Lisans

MIT
