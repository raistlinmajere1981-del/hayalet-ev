# Plan: Minimal Electron CDP Tool Integration

**Generated**: 2026-03-21
**Estimated Complexity**: Medium

## Overview
Hayalet-ev MCP tarafında tool kalabaligi yaratmadan, sadece gelistirme sirasinda tekrarli deger uretecek eksik CDP yetenekleri eklenecek. Ana hedef yeni bir Electron process manager yazmak degil; mevcut `hev_*` CDP katmanina target-aware debug yetenegi eklemek.

## Scope
- Eklenecek adaylar:
  - `hev_list_cdp_targets`
  - `hev_get_cdp_target_info`
  - `hev_send_cdp_command`
- Opsiyonel ikinci dalga:
  - `hev_reload_cdp_target`
  - `hev_pause_debugger`
  - `hev_resume_debugger`
- Disarida birakilacaklar:
  - Generic Electron app start/stop/list process manager
  - Resource-only API modeli
  - Sahte CPU/RAM telemetry

## Sprint 1: Target Discovery
**Goal**: Mevcut tek-hedef CDP akisina, gorunur ve secilebilir target kavrami eklemek.
**Demo/Validation**:
- MCP uzerinden mevcut CDP target listesi okunabilir.
- Her target icin `id`, `type`, `title`, `url` gorulebilir.
- Var olan tool'lar bozulmadan calismaya devam eder.

### Task 1.1: CDP target modelini netlestir
- **Location**: `src/mcp-server/utils/cdp-connection.ts`
- **Description**: Mevcut `discoverTargets()` cikisini ortak kullanilabilir bir tip ve secim yardimcisi ile duzenle.
- **Dependencies**: Yok
- **Acceptance Criteria**:
  - Hedefler tek yerde normalize edilir.
  - Varsayilan "ilk page target" davranisi backward-compatible kalir.
- **Validation**:
  - Tip kontrolu
  - Mevcut CDP tool regression kontrolu

### Task 1.2: `hev_list_cdp_targets` tool'unu ekle
- **Location**: `src/mcp-server/tools/cdp-tools.ts`, `src/mcp-server/core/handlers/cdp/connection-tools.ts`
- **Description**: Tum gorunen target'lari listeleyen dusuk-riskli bir inspection tool ekle.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Liste metninde `id`, `type`, `title`, `url` yer alir.
  - Baglanti yoksa hata mesaji mevcut i18n/usulune uyar.
- **Validation**:
  - Handler registry testi
  - Manuel MCP cagrisi

### Task 1.3: `hev_get_cdp_target_info` tool'unu ekle
- **Location**: `src/mcp-server/tools/cdp-tools.ts`, `src/mcp-server/core/handlers/cdp/inspection-tools.ts`
- **Description**: Tek target icin ayrintili bilgi ve desteklenen temel CDP domain ozetini dondur.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Gecersiz target id icin net hata doner.
  - Cikti, debug siralarinda dogrudan kullanilabilir kadar kisa olur.
- **Validation**:
  - Manuel target secimi ile smoke test

## Sprint 2: Raw CDP Access
**Goal**: Sorunlu vakalarda yeni tool yazmadan raw CDP command gonderebilmek.
**Demo/Validation**:
- Belirli bir target'a `Page.reload` veya `Runtime.evaluate` benzeri komut gonderilebilir.
- Basarisiz domain/method cagrisinda anlamli hata doner.

### Task 2.1: Target-aware CDP helper ekle
- **Location**: `src/mcp-server/utils/cdp-connection.ts`
- **Description**: `withConnection` yanina, `targetId` alan bir baglanti yardimcisi ekle.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Varsayilan akis korunur.
  - Belirli target secimi desteklenir.
- **Validation**:
  - Bir page target'a baglanip `Runtime.enable` cagrisi

### Task 2.2: `hev_send_cdp_command` tool'unu ekle
- **Location**: `src/mcp-server/tools/cdp-tools.ts`, `src/mcp-server/core/handlers/cdp/connection-tools.ts`
- **Description**: `targetId`, `domain`, `method`, `params` ile raw CDP cagrisi yapan tek bir ileri-seviye tool ekle.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Sadece bir adet generic low-level tool eklenir.
  - JSON parametreleri dogrulanir.
  - Sonuc JSON olarak okunabilir doner.
- **Validation**:
  - `Page.reload`
  - `Runtime.evaluate`

### Task 2.3: Tool discovery ve yonlendirme guncelle
- **Location**: `src/mcp-server/tools/tool-discovery.ts`, ilgili i18n tanimlari
- **Description**: Yeni tool'lar sadece ileri debug niyetlerinde onerilsin; default akista once mevcut yuksek-seviye tool'lar onerilmeye devam etsin.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `hev_send_cdp_command` herkese ilk oneri olmaz.
  - Tool kalabaligi davranissal olarak da kontrol altinda kalir.
- **Validation**:
  - `hev_suggest_tool` davranis smoke testi

## Sprint 3: Optional Thin Wrappers
**Goal**: Sik tekrar eden 2-3 CDP komutu icin sadece gerekiyorsa ince wrapper eklemek.
**Demo/Validation**:
- Wrapper eklenirse raw tool yerine daha hizli kullanim saglar.
- Wrapper eklenmezse plan tamamlanmis sayilir.

### Task 3.1: Wrapper ihtiyacini kararlandir
- **Location**: Yok
- **Description**: Gelistirme akisinda en cok tekrar eden komutlar incelenir.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - En fazla 2-3 wrapper secilir ya da hic secilmez.
- **Validation**:
  - Son 2-3 debug senaryosu uzerinden degerlendirme

### Task 3.2: Gerekirse ince wrapper ekle
- **Location**: `src/mcp-server/tools/cdp-tools.ts`, ilgili handler dosyasi
- **Description**: Sadece cok kullanimli komutlar icin wrapper ekle: ornek `reload`, `pause`, `resume`.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Wrapper, raw tool'un tekrar eden parametre yukunu azaltir.
  - Yeni kategori/karma workflow olusturmaz.
- **Validation**:
  - Manuel smoke test

## Testing Strategy
- Registry seviyesi: yeni tool isimleri handler listesinde gorunmeli.
- Utility seviyesi: target secimi ve hata durumlari korunmali.
- Manual smoke:
  - target listeleme
  - target info
  - raw `Runtime.evaluate`
  - raw `Page.reload`
- Regression:
  - `hev_check_electron_connection`
  - `hev_take_cdp_screenshot`
  - `hev_toggle_mcp_panel_servers`

## Potential Risks & Gotchas
- Target id'ler gecici olabilir; UI metinleri target seciminde yardimci olmali.
- Raw CDP tool fazla serbest olursa default debug akisini kirabilir; `tool-discovery` ile sinirlanmali.
- Mevcut "ilk page target" varsayimi bozulursa var olan tool'larda gizli regression olabilir.

## Rollback Plan
- Yeni tool registration'larini kaldir.
- `cdp-connection.ts` icindeki target-aware yardimcilari geri al.
- Mevcut tek-target davranisini source of truth olarak birak.
