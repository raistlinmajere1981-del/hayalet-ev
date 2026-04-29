# Project Workspace Consolidation — Source Intake + Hypothesis + Assets Cleanup

Source Intake, Hypothesis ve Proje Varlıkları panelini Project Workspace overlay'e taşı; drawer ve center panel'deki kopyaları temizle.

## Kapsam

- **Source Intake** (İçe Aktarma Rotası + kaynak tipi/rota + URL/YouTube/Local formları) → Project Workspace sol panele (nav altına) entegre
- **Hypothesis** textarea → Project Workspace header altına veya grid üstüne entegre
- **PROJE VARLIKLARI** (drawer'daki proje seçici + asset listesi) → Zaten entity grid olarak mevcut, drawer kopyaları temizlenir
- Drawer ve center panel'deki kopyalar kaldırılır

## Değişiklikler

### 0. `lab-root.ts` — Temiz proje ile açılışta overlay otomatik aç
- İlk render sonrası, eğer source yoksa (`state.source === null`) ve proje yeniyse → `project-workspace-toggled` dispatch et
- Boot overlay unlock sonrasında tetiklenmeli (kullanıcı arayüzü hazır olduktan sonra)

### 1. `project-workspace-overlay.ts` — Grid yapısını güncelle
- Header altına Source Intake bölümü ekle (sol panel nav'ın üstüne veya nav içine)
- Grid üstüne hypothesis textarea ekle
- İmport: `renderSourceIntake`, `renderWorkspaceHypothesis`, gerekli selectors

### 2. `styles/project-workspace.css` — Grid'i genişlet
- Nav alanını üst (source-intake) ve alt (project list) olarak böl, veya overlay grid'e `intake` satırı ekle
- Hypothesis alanı için stil (grid area'nın toolbar satırına veya üstüne)

### 3. `project-navigation.ts` — Source Intake'i nav'a entegre et
- Sol panelin üst kısmına Source Intake çağrısını ekle (collapsible)
- Proje listesi alt kısımda kalır

### 4. `lab-drawer.ts` — Drawer'dan kaldır
- **Setup mode**: `renderSourceIntake` çağrısını kaldır, `renderDrawerAssetsPanel` çağrısını kaldır (includeProjectControls ile birlikte)
- **Result mode**: `renderDrawerAssetsPanel` çağrısını kaldır
- **Explore mode**: `renderDrawerAssetsPanel` çağrısını kaldır
- Kullanılmayan importları temizle (`renderSourceIntake`, `renderLabProjectAssetsPanel`)

### 5. `workspace-surface.ts` — Center panel'den kaldır
- `renderWorkspaceHypothesis` çağrısını `renderWorkspaceSurface` ana output'undan kaldır
- Kullanılmayan importu temizle

### 6. `asset-grid.ts` — Hypothesis'i toolbar'a entegre et
- Grid toolbar'ın altına veya üstüne hypothesis textarea'yı ekle
- `getHypothesis` selector'ı ve `getWorkspaceLockState` import'u ekle

### 7. Typecheck
- `npm run typecheck` ile doğrula
