# PATCH 6.1 — Visual Focus Correction (Rev. 2)

Laboratory sağ paneli (drawer) için yalnızca `lab-theme.css` üzerinde yapılacak; hedef hiyerarşi: **Video → Decision header → Pipeline blokları → Settings → Timeline**.

## Kapsam & Güvenlik

- **Tek dosya:** `rooms/laboratory/ui/lab-theme.css`
- **Sadece CSS:** HTML yapı, TS render, attribute şeması, class adları değişmez → fonksiyonel etki **yok**.
- **Tema token'ları:** base.css'deki mevcut token'lara dokunulmaz; `--labx-bg-main` tanımsızlığı `.labx-drawer` üstünde doğrudan değerle kapatılır.
- **Revert kolaylığı:** tüm değişiklikler 6 mevcut seçicide yerinde düzenleme + 1 noktada hover override'ı.

## Hedeflenen Bloklar (mevcut satırlar)

- `.labx-decision-header` → `lab-theme.css:6558-6591`
- `.labx-pipeline-block` → `lab-theme.css:6128-6144`
- `.labx-settings-block__summary` + `__summary:hover/:focus-visible` + `__action` + `__title::before` → `lab-theme.css:4110-4203`
- `.labx-drawer` (V3) + `.labx-drawer__section` + `.labx-drawer__section h3` → `lab-theme.css:6100-6158`
- `.labx-timeline` base → `lab-theme.css:1251-1261` (focus varyantları dokunulmaz)

## Değişiklik Detayı

### 1. Decision Header — Baskın ama Rafine
- `.labx-decision-header`: `padding` `0.65rem 0` → `0.95rem 0 0.85rem`; `margin-bottom` `0.35rem` → `0.55rem`.
- `.labx-decision-header__title`: `font-size` `1.1rem` → **`1.35rem`** (~%23, blok hissi vermez); `font-weight` `700` → `800`; **`line-height: 1.25` → `1.15`** (sıkışma hissini azaltır); `letter-spacing: -0.01em`.
- `.labx-decision-header__subtitle`: `opacity: 0.7` eklenir (sesli gürültü azaltılır); renk/font-size sabit.
- State renkleri (`ready` / `running` / `done`) değişmez.

### 2. Pipeline Bloklarını Kart Hissettir — Spacing Dengeli
- `.labx-pipeline-block`: `padding` `0.55rem 0` → **`0.65rem 0.75rem`**; `background: rgba(255,255,255,0.018)`; `border: 1px solid rgba(255,255,255,0.06)`; `border-radius: 0.55rem`.
- Blok arası: `.labx-pipeline-block + .labx-pipeline-block` üst `border-top` kaldırılır, yerine **`margin-top: 0.45rem`**.
- Aktif blok (`[data-block-type="action"]`): mevcut `inset 2px 0 0` aksan çizgisi kaldırılır → `border-color: rgba(92,215,223,0.32)` + premium glow **`box-shadow: 0 0 0 1px rgba(92,215,223,0.10), 0 0 10px rgba(92,215,223,0.05)`** (ikinci katman %20 azaltıldı).

### 3. "Ayarlar" Tekrarlarını Sessizleştir — Enterprise Hissi
- `.labx-settings-block__summary`: tüm cyan gradient + border kaldırılır → **`background: transparent`**; **`border: 1px solid rgba(255,255,255,0.05)`**; `box-shadow: none`; `font-size` `0.72rem` → `0.66rem`; `font-weight` `700` → `500`; `color: var(--labx-text-soft)`; mevcut `letter-spacing: 0` + text-transform yokluğu korunur (ek silme gerekmiyor).
- `.labx-settings-block__summary:hover`, `:focus-visible`: cyan patlama söndürülür → `border-color: rgba(255,255,255,0.14)`; `background: rgba(255,255,255,0.03)`; `box-shadow: none`; `color: var(--labx-text)`.
- `.labx-settings-block__action`: accent kaldırılır → `border: 1px solid rgba(255,255,255,0.10)`; `background: transparent`; `color: var(--labx-text-dim)`; `font-size` `0.66rem` → `0.62rem`; padding daraltılır; **hover'da parlama yok** (summary hover zaten action rengini etkilemiyor, ek kural gerekmez; action kendi hover kuralı yoksa dokunulmaz).
- `.labx-settings-block__title::before` ok işareti: `opacity: 0.6`.
- `.labx-settings-block__reset` dokunulmaz.

### 4. Sağ Paneli Sessizleştir — Mavi Alt Tonla Ayrış
- `.labx-drawer` (V3): `background` → **`rgba(8, 14, 24, 0.82)`** (video'dan mavi alt tonla ayrışır, sessiz kalır).
- İç ayrımlar: `.labx-drawer__section` bottom border `var(--labx-border)` → `rgba(255,255,255,0.05)` (~%15 düşük kontrast).
- `.labx-decision-header` alt border `rgba(255,255,255,0.06)` → `rgba(255,255,255,0.05)`.

### 5. Timeline'ı Araç Konumuna İt
- `.labx-timeline` base: **`opacity: 0.94`** eklenir; border `var(--labx-border)` → `rgba(116, 155, 193, 0.12)`; **`background: rgba(6,12,20,0.88)` → `rgba(0,0,0,0.25)`** (daha baskın, gürültüsüz araç hissi).
- Handles/playhead/seçim/focus varyantları **değişmez** — fonksiyonel odak + locked davranışı korunur.

### 6. Görsel Hiyerarşi Zinciri — Pipeline Başlıkları Header ile Yarışmasın
- `.labx-drawer__section h3`: `font-weight` `600` → **`500`**; mevcut `color: var(--labx-text-soft)` korunur (değişiklik gerekmez); diğer satırlar (uppercase/letter-spacing) değişmez — yapı bütünlüğü korunur.

### 7. Güvenlik Kuralı
- Herhangi bir ek element eklenmez; shadow, border, spacing dışında kural eklenmez.
- Emin olunamayan yerde yeni efekt yerine kontrast/boşluk düşürülür (patch 6.1 kuralı).

## Doğrulama

- `npx prettier --check rooms/laboratory/ui/lab-theme.css` (syntax/format)
- `npm run typecheck` (smoke — CSS-only değişiklik)
- Uygulama başlatılmaz; kullanıcı görsel teyit için UI'da kontrol eder.

## Etkilenen Dosyalar

- `rooms/laboratory/ui/lab-theme.css` — tek dosya, 6 mevcut bölge düzenleme + 1 hover override eklenmesi.
