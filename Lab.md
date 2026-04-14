Repo içinde önce ilgili laboratory dosyalarını bul, sonra patch sırasını birebir uygula.
Bir patch bitmeden diğerine geçme.
Her patch sonunda kısa self-check yap.
Belirsizlikte yeni UI üretme; mevcut yapıyı sadeleştir.

# LAB-PATCH-PLAN v1

## PATCH STRATEJİSİ

Uygulama sırası değişmeyecek.

Önce akış/state kilitlenecek.
Sonra step yüzeyleri sadeleşecek.
En son dependency/runtime UI hizalanacak.

---

# PATCH 0 — DOSYA HARİTASI ÇIKAR

## AMAÇ

Laboratory akışını üreten gerçek dosyaları bul.

## ARAMA KOMUTLARI

```bash
rg -n "Proje rotasını kur|Kaynak alımı|Yerel Kaynağı Kopyala" .
rg -n "Düzenleme çalışma yüzeyi|Video kontrolleri|Önizleme Üret|Türetilmiş Çıktı Üret" .
rg -n "Koşu öncesi readiness kontrolü yap|Preflight Çalıştır" .
rg -n "Rehberli analizi çalıştır|Koşuyu Yeniden Başlat|Raporu Aç" .
rg -n "Laboratuvar sonucunu incele|Rapor Özeti|Öncelikli Bulgular" .
rg -n "Bağımlılıklar ve Modeller|Araç envanteri|Workbench readiness" .
rg -n "StepSidebar|StepContextPanel|DiagnosticsDrawer|LaboratoryPage" .
```

## BEKLENEN ÇIKTI

Aşağıdaki dosya grupları bulunmalı:

* Laboratory ana page/container
* step sayfaları veya step render switch dosyası
* sağ panel/context component
* diagnostics/log component
* dependency center modal/component
* readiness/model state store veya hook
* step geçiş mantığı / navigation / reducer / state machine

---

# PATCH 1 — STATE MACHINE KATMANI

## AMAÇ

UI’yı component bazlı sezgilerle değil, step state kurallarıyla yönet.

## HEDEF DOSYA SINIFI

* `stateMachine`
* `useLaboratoryState`
* `laboratoryReducer`
* `stepFlow`
* `wizardState`
* `workflowStore`

## EKLENECEK YAPI

```ts
type LaboratoryStep = "source" | "edit" | "profile" | "run" | "report";

type LaboratoryGuards = {
  projectSelected: boolean;
  sourceAttached: boolean;
  modelReady: boolean;
  preflightDone: boolean;
  runStarted: boolean;
  runFinished: boolean;
};
```

## GEÇİŞ KURALLARI

```ts
source -> edit      only if projectSelected && sourceAttached
edit   -> profile   only if sourceAttached
profile-> run       only if modelReady && preflightDone
run    -> report    only if runFinished
```

## PATCH İŞİ

* mevcut “ileri/geri step” mantığını bul
* koşulsuz geçişleri kaldır
* guard bazlı transition ekle
* UI bu state machine’den beslensin

## KABUL KRİTERİ

* Step3 tamamlanmadan Step4 açılmaz
* modelReady false iken run adımı pasif kalır

---

# PATCH 2 — STEP 1 SOURCE KIRPMA

## AMAÇ

Kaynak adımını tek işe indir: proje seç + kaynak ekle

## HEDEF DOSYA SINIFI

* `Step1SourcePage`
* `ProjectSelectorCard`
* `SourceIntakeCard`
* `Step1ContextCard`
* sağ panel modül listesi componenti

## YAPILACAK DEĞİŞİKLİKLER

### 2.1 Project gating

```tsx
if (!projectSelected) {
  render(ProjectSelectorCard);
  hide(SourceIntakeCard);
}
```

### 2.2 Source reveal

```tsx
if (projectSelected) {
  render(SourceIntakeCard);
}
```

### 2.3 Sağ panel temizliği

Kaldır:

* modül listesi
* koşuya ekle
* aktif modülü seç
* modül bazlı aksiyonlar

Bırak:

* aktif proje özeti
* kısa durum metni

### 2.4 Primary CTA sabitle

Tek primary:

* `AttachSourceButton`

Proje oluştur/sil:

* secondary veya tertiary

## KABUL KRİTERİ

* project seçilmeden source intake görünmez
* Step1’de modül seçimi görünmez
* sağ panel tek karttır

---

# PATCH 3 — STEP 2 EDIT AYRIŞTIRMA

## AMAÇ

Düzenleme ekranındaki çoklu odak kırılmasını bitir.

## HEDEF DOSYA SINIFI

* `Step2EditPage`
* `OperatorModeCard`
* `VideoControlsCard`
* `PreviewOutputCard`
* `EditStatusSummary`
* step2 sağ panel container

## YAPILACAK DEĞİŞİKLİKLER

### 3.1 Tek primary action seç

Aşağıdakilerden sadece biri primary olacak:

* `GeneratePreviewButton`
* `GenerateOutputButton`

Diğeri secondary olacak.

### 3.2 Main surface sadeleştir

Varsayılan görünür:

* OperatorModeCard
* PreviewOutputCard

Collapse / accordion / drawer içine taşı:

* VideoControlsCard içindeki gelişmiş toggle’lar
* advanced sliders
* düşük frekanslı ayarlar

### 3.3 Sağ panel tek karta indir

Kaldır:

* işlem akışı kartı
* çıktı listesi kartı
* çoklu özet blokları

Bırak:

* `EditStatusSummary`

İçerik:

* aktif preset
* son işlem
* durum

### 3.4 İptal aksiyonlarını aşağı çek

Cancel / reset / stop benzeri aksiyonlar

* ghost / tertiary stil
* primary ile yarışmayacak

## KABUL KRİTERİ

* Step2’de tek primary CTA görünür
* sağ panel tek karttır
* advanced video controls varsayılan kapalıdır

---

# PATCH 4 — STEP 3 PROFILE + RUNTIME GATE

## AMAÇ

Preflight’ı gerçek kapı haline getir.

## HEDEF DOSYA SINIFI

* `Step3ProfilePage`
* `PreflightActionCard`
* `RunPreflightButton`
* readiness summary component
* model status hook/store

## YAPILACAK DEĞİŞİKLİKLER

### 4.1 Primary action koru

Tek primary:

* `RunPreflightButton`

### 4.2 Model readiness aksiyona bağla

Pasif uyarıyı kaldır:

* “Whisper model kur ve doğrula” metni tek başına durmayacak

Yerine:

* `InstallAndVerifyModelButton`

### 4.3 Step4 geçiş guard

```ts
canEnterRunStep = modelReady && preflightDone
```

### 4.4 Sağ panel kısalt

Bırak:

* medya adı
* uyarı sayısı
* kısa readiness

Uzun açıklamaları kaldır.

## KABUL KRİTERİ

* modelReady false ise CTA ile çözüm sunulur
* preflightDone false ise run step açılamaz

---

# PATCH 5 — STEP 4 RUN FİİLİNİ TEKLE

## AMAÇ

Run adımını “çalıştır / izle” karakterine sabitle.

## HEDEF DOSYA SINIFI

* `Step4RunPage`
* `RunStatusCard`
* `RunTimelineCard`
* `RunActionsCard`
* run step sağ panel component

## YAPILACAK DEĞİŞİKLİKLER

### 5.1 Primary / secondary ayrımı

Primary:

* `RestartRunButton` veya `ContinueRun`

Secondary:

* `OpenReportButton`

### 5.2 Orta alanı doldur

Timeline/progress alanını büyüt.
Boş yüzey hissini azalt.

### 5.3 Sağ panel sadece aksiyon

Kaldır:

* tekrar özetler
* uzun uyarı blokları
* duplicate status listeleri

Bırak:

* aksiyonlar
* çok kısa durum

## KABUL KRİTERİ

* `OpenReportButton` primary görünmez
* run step’in ana yüzeyi status + timeline olur

---

# PATCH 6 — STEP 5 REPORT DEDUP

## AMAÇ

Rapor ekranını tek merkezli yap.

## HEDEF DOSYA SINIFI

* `Step5ReportPage`
* `ReportSummaryCard`
* `ReportDetailCard`
* `ModuleStatusList`
* report sağ panel component

## YAPILACAK DEĞİŞİKLİKLER

### 6.1 Sağ panel sadeleştir

Bırak:

* `ModuleStatusList`

Kaldır:

* warnings duplication
* report stats duplication
* analiz özeti tekrarları

### 6.2 Merkez alanı güçlendir

Orta alan:

* ReportSummaryCard
* ReportDetailCard

Raporun tek sahibi burası olacak.

## KABUL KRİTERİ

* aynı metrik sağ panelde tekrar etmez
* report main content yalnız merkezde bulunur

---

# PATCH 7 — CONTEXT PANEL ENFORCEMENT

## AMAÇ

Tüm step’lerde sağ panel davranışını tek kurala bağla.

## HEDEF DOSYA SINIFI

* `StepContextPanel`
* ortak `ContextCard`
* step bazlı right panel render switch

## YAPILACAK DEĞİŞİKLİKLER

### KURAL

Her step için sağ panel:

* max 1 card
* max 6 satır ana bilgi
* no CTA overload
* no duplicate data

### UYGULAMA

Step bazlı right panel map oluştur:

```ts
const contextPanelByStep = {
  source: <Step1ContextCard />,
  edit: <Step2ContextCard />,
  profile: <Step3ContextCard />,
  run: <Step4ContextCard />,
  report: <Step5ContextCard />,
};
```

## KABUL KRİTERİ

* hiçbir step’te sağ panel 1 kartı geçmez

---

# PATCH 8 — DIAGNOSTICS DRAWER BİRLEŞTİR

## AMAÇ

Teknik detayları ana yüzeyden çıkar.

## HEDEF DOSYA SINIFI

* `DiagnosticsDrawer`
* `EventLogPanel`
* `TechnicalDetailsPanel`
* `DependencyDetailsPanel`

## YAPILACAK DEĞİŞİKLİKLER

### KURAL

Diagnostics:

* default closed
* step’lerden bağımsız ortak alt katman
* sağ panele teknik detay taşınmaz

### PATCH

* event/log/technical/dependency detaylarını ortak drawer içinde topla
* mevcut sağ panel veya orta panel içindeki teknik blokları çıkar

## KABUL KRİTERİ

* teknik detaylar ilk açılışta görünmez

---

# PATCH 9 — DEPENDENCY CENTER GERÇEKLİK HİZASI

## AMAÇ

Dependency center, runtime’ı doğru anlatsın; sahte aksiyon üretmesin.

## HEDEF DOSYA SINIFI

* `DependencyCenterModal`
* `ToolInventory`
* `ModelReadinessSummary`
* dependency item card
* tool support matrix config

## YAPILACAK DEĞİŞİKLİKLER

### 9.1 Managed / External ayrımı

Gruplar:

* Managed tools
* External tools

Örnek:

* yt-dlp, ffmpeg -> managed
* whisper.cpp -> external

### 9.2 Unsupported tool davranışı

Kural:

* unsupported ise action button yok
* fake update butonu yok

### 9.3 Missing dependency davranışı

Kural:

* passive warning yerine çözüm CTA

Örnek:

* install
* verify
* locate binary

## KABUL KRİTERİ

* unsupported araç “güncelle” butonu göstermez
* missing dependency sadece uyarı değil, aksiyon da sunar

---

# PATCH 10 — WARNING DEDUP + COPY TIGHTENING

## AMAÇ

Tekrarlayan uyarıları ve uzun copy’leri kıs.

## HEDEF DOSYA SINIFI

* warning renderer
* alert list component
* copy constants / labels / i18n dosyaları

## YAPILACAK DEĞİŞİKLİKLER

### 10.1 Warning dedup

Aynı anahtara sahip uyarılar birleşsin.

```ts
dedupe by:
- code
- source
- target step
```

### 10.2 Copy kısalt

Sağ panel ve warning yüzeylerinde:

* tek cümle
* aksiyon varsa fiille başla
* uzun açıklamalar tooltip/drawer’a

## KABUL KRİTERİ

* aynı warning birden fazla görünmez
* sağ panel kopyaları kısa kalır

---

# PATCH 11 — ACCEPTANCE GATE

## AMAÇ

Codex kendi çıktısını ölçsün.

## HEDEF DOSYA SINIFI

* yok, rapor üretimi

## ZORUNLU RAPOR FORMATTI

```text
FILES CHANGED:
- path1
- path2

PRIMARY ACTION MAP:
- source: AttachSourceButton
- edit: GeneratePreviewButton
- profile: RunPreflightButton
- run: RestartRunButton
- report: InspectReportSurface

ACCEPTANCE:
- Step1 single primary: PASS/FAIL
- Step1 no module picker: PASS/FAIL
- Step2 single primary: PASS/FAIL
- Step2 right panel single card: PASS/FAIL
- Step3 runtime gate: PASS/FAIL
- Step4 report secondary: PASS/FAIL
- Step5 no right-panel duplication: PASS/FAIL
- diagnostics default closed: PASS/FAIL
```

---

# PATCH SIRASI ÖZETİ

```text
1. dosya haritası çıkar
2. state machine / guards
3. step1 source gating
4. step2 edit simplification
5. step3 runtime gate
6. step4 action split
7. step5 report dedup
8. right panel enforcement
9. diagnostics drawer centralization
10. dependency center truth alignment
11. warning dedup
12. acceptance report
```

---

# CODEX’E SON SATIR

```text
Yeni özellik ekleme.
Yeni panel ekleme.
Yeni akış icat etme.
Sadece mevcut laboratory workflow'unu state-machine tabanlı, tek-fiilli, tek-primary-action yapıya refactor et.
```

