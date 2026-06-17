# Android Companion Topbar Settings Plan

## Hedef
Analyze sayfasındaki Android companion / dikte / TTS / ambient / kamera ayarlarını sayfaya özel kontrollerden çıkarıp topbardaki companion göstergelerinin altına taşımak. Ayar paneli topbar altında bir butonla açılacak ve overlay genişliği sabit modal genişliği yerine içeriğe göre ayarlanacak.

## Güncellenen Kapsam
- `image.png` okunamadı; bu model image input desteklemiyor. Plan kaynak kod incelemesine göre güncellendi.
- Analyze compose içindeki `#analyze-tts-settings-btn` kaldırılacak.
- Analyze compose içindeki `Android dictate` checkbox'ı (`#compose-android-dictation-toggle` / `#compose-android-dictation-checkbox`) kaldırılacak; aynı tercih ayar overlay'indeki `Dikte > Kaynak` seçimiyle yönetilecek.
- Analyze compose içindeki `Ambient kapalı.` göstergesi (`#compose-ambient-status`) kaldırılacak; topbardaki operation göstergeleri bu durumu üstlenecek.
- Analyze compose içindeki `Voice command pasif` butonu (`#compose-voice-command-btn`) kaldırılacak; voice command aç/kapat ayarı overlay içindeki `Komut dinleme` checkbox'ıyla yönetilecek.
- Ambient başlat/durdur butonu (`#compose-ambient-btn`) şimdilik korunacak; sadece pasif status göstergesi kaldırılacak.

## Mevcut Durum
- Ayarlar `src/js/pages/analyze.ts` içinde `_openOperationSettingsOverlay()` ile oluşturuluyor.
- Eski açılış butonu `src/pages/analyze.html` içindeki `#analyze-tts-settings-btn`.
- `Android dictate` checkbox'ı `src/pages/analyze.html` içindeki `.compose-dictation-source` bloğunda; davranışı `bindActions()` ve `_renderDictationModeToggle()` içinde.
- `Voice command pasif/aktif` butonu `#compose-voice-command-btn`; davranışı `_renderVoiceCommandToggle()` ve `_toggleVoiceCommands()` içinde.
- `Ambient kapalı.` metni `#compose-ambient-status`; davranışı `_renderAmbientFeedback()`, `_resolveAmbientFeedback()` ve `_defaultAmbientStatusMessage()` içinde.
- Topbar companion göstergeleri `src/index.html` içindeki `#topbar-operations-strip` ve `operation-indicator-*` elemanları.
- Göstergelerin davranışı `src/js/app/operations-indicators.ts` içinde yönetiliyor.
- Ayar panelinin CSS'i `src/styles/analyze.css` içinde `.analyze-operation-settings*` kurallarıyla tanımlı.
- Regression testi `scripts/tests/analyze-capture-ingress-regressions.test.ts`, eski Analyze kontrollerini bekliyor.

## Uygulama Adımları
1. `src/pages/analyze.html`
   - `#analyze-tts-settings-btn` butonunu compose header'dan kaldır.
   - `#compose-android-dictation-toggle` bloğunu kaldır.
   - `#compose-voice-command-btn` butonunu kaldır.
   - `#compose-ambient-status` span'ini kaldır.
   - `#compose-dictation-btn`, `#compose-ambient-btn`, kamera/capture import ve send kontrolleri korunacak.

2. `src/index.html`
   - `#topbar-operations-strip` içine veya hemen altına yeni companion ayar butonu ekle.
   - Buton topbar companion göstergeleriyle görsel olarak ilişkili olacak.
   - ID önerisi: `topbar-companion-settings-btn`.
   - `data-shell-i18n-title` ve `data-shell-i18n-aria-label` için yeni shell çeviri anahtarı kullanılacak.

3. `src/js/pages/analyze.ts`
   - `_openOperationSettingsOverlay()` içindeki içerik oluşturma mantığını Analyze controller instance'ına bağlı kalmayacak şekilde modül seviyesine taşımak veya dışarıdan çağrılabilecek fonksiyona bölmek.
   - Topbar butonu Analyze sayfasında olmasak bile çalışacağı için fonksiyon kendi içinde `refreshCaptureStatus()`, `getTtsStatus()` ve `SettingsManager` snapshot helper'larını kullanmalı.
   - `runCaptureAction('launch-companion', ...)`, TTS model hazırlama, dictation mode/language, voice command checkbox ve settings patch/set davranışları korunmalı.
   - Analyze controller'dan çağrıldığında mevcut state senkronu bozulmasın diye opsiyonel callback veya küçük wrapper ile `_captureStatus`, `_ttsRuntimeStatus`, `_syncDictationAvailability()`, `_renderAmbientToggle()`, `_syncVoiceCommandSettings()` gibi güncellemeler korunmalı.
   - Eski `#analyze-tts-settings-btn` binding ve aktif state güncellemesi kaldırılmalı.
   - `#compose-android-dictation-checkbox` change binding'i kaldırılmalı.
   - `_renderDictationModeToggle()` DOM checkbox'a bağımlı olmayacak şekilde sadeleştirilmeli veya kaldırılmalı; `_syncDictationAvailability()` sadece seçili ayar moduna göre `bindDictationTrigger` durumunu yenilemeli.
   - `#compose-voice-command-btn` binding'i kaldırılmalı; `_renderVoiceCommandToggle()` DOM hedefi olmayınca no-op kalabilir veya çağrıları temizlenebilir.
   - `_toggleVoiceCommands()` UI butonu kalmayacağı için kullanılmıyorsa kaldırılmalı; ayar değişimi overlay'deki `voiceEnabledInput` üzerinden devam etmeli.
   - `_renderAmbientFeedback()` artık sayfa içi status DOM'una yazmamalı; toast ve internal state akışı korunmalı. `Ambient kapalı.` metni sayfada görünmemeli.
   - `_defaultAmbientStatusMessage()` toast/log akışı için kalabilir; sadece `#compose-ambient-status` yüzeyi kaldırılacak.

4. `src/js/app/operations-indicators.ts`
   - Yeni topbar butonuna click listener bağla.
   - Click handler ortak companion settings overlay fonksiyonunu açsın.
   - Duplicate listener riskine karşı module-level `bound` guard kullan.
   - Gerekiyorsa butonun active/expanded durumu overlay kapanınca sıfırlansın.

5. `src/styles/main.css` veya uygun topbar component CSS
   - Companion göstergelerinin altındaki buton için layout ekle.
   - `#topbar-operations-strip` yatay göstergeleri korunsun; buton alt satırda veya kompakt aksiyon olarak konumlansın.
   - Küçük ekranlarda taşma yapmaması için flex-wrap / max-width davranışı düzenlensin.

6. `src/styles/analyze.css`
   - `.compose-voice-command-btn` ve `.compose-ambient-status` stilleri kaldırılmalı.
   - `.compose-dictation-source` stilleri sadece başka kullanım yoksa kaldırılmalı.
   - `.analyze-operation-settings` için sabit `min-width: var(--layout-analyze-operation-settings-min-w)` davranışını overlay/modal özelinde kaldır veya daha dar `width: fit-content; max-width: min(...);` yaklaşımına çevir.
   - İçerik genişliğine göre büyüme için grid'i `repeat(2, minmax(min-content, ...))` veya uygun `fit-content` tabanlı hale getir.
   - Mobil media rule korunarak tek kolona düşmesi sağlanmalı.

7. `shared/languages/tr/index.json` ve `shared/languages/en/index.json`
   - Topbar buton title/aria metni ekle.
   - `operationSettings.title` metni Analyze'a özel olmayan bir başlığa güncellenebilir.
   - `androidToggleLabel`, `voiceCommandInactive` ve sayfa içi ambient idle görünümü için kullanılan metinler kullanım dışı kalırsa kaldırılabilir; toast/ambient state fallback'i kullanıyorsa korunur.

8. `scripts/tests/analyze-capture-ingress-regressions.test.ts`
   - Eski `#analyze-tts-settings-btn`, `#compose-android-dictation-checkbox`, `#compose-voice-command-btn` ve `#compose-ambient-status` beklentileri kaldırılır veya `doesNotMatch` olarak güncellenir.
   - Topbar butonunun `src/index.html` içinde bulunduğu ve `src/js/app/operations-indicators.ts` tarafından bağlandığı doğrulanır.
   - Overlay içinde dictation mode (`capture.defaults.dictationMode`) ve voice command ayarı (`voiceCommands.analyzeEnabled`) yönetiminin sürdüğü doğrulanır.
   - Ortak overlay fonksiyonunun hâlâ `analyze.ts` veya yeni modülde mevcut olduğu kontrol edilir.

## Doğrulama
- `npm run typecheck`
- `node --import tsx --test scripts/tests/analyze-capture-ingress-regressions.test.ts`
- Gerekirse hedefli lint: `npx eslint src/js/pages/analyze.ts src/js/app/operations-indicators.ts`

## Notlar
- Uygulama aşamasında kod değişikliği için proje kuralı gereği ayrıca değişiklik onayı alınmalı.
