# Repair Room God-File Refactor Plan

## Amaç

Repair Room içindeki büyük dosyaları mevcut oda mimarisine uygun alt modüllere ayırmak. Davranış değişikliği hedeflenmez; amaç dosyaları daha rahat okunur, test edilir ve sürdürülebilir hale getirmektir.

## Ön Analiz

En büyük god-file adayları:

| Dosya | Satır | Rol |
| --- | ---: | --- |
| `rooms/repair-room/host/runtime.ts` | 3835 | Host runtime, komutlar, storage, AI, operations, session akışı |
| `rooms/repair-room/ui/repair-room-ui-runtime.ts` | 3576 | UI runtime, shell, panel lifecycle, event binding, host mesajları |
| `rooms/repair-room/ui/style.css` | 2588 | Repair Room tüm görünüm kuralları |
| `rooms/repair-room/host/state/repair-replay-projection.ts` | 2014 | Replay, spatial, measurement, guidance projection üretimi |
| `rooms/repair-room/ui/overlay/overlay-stage.ts` | 1755 | Konva overlay stage, çizimler, interaction, incremental sync |

Mevcut klasör yapısı parçalama için uygun:

- `host/`: oda host runtime ve entegrasyonları
- `host/state/`: state, reducer, selector, projection
- `ui/`: UI runtime ve entrypoint
- `ui/panels/`: panel render dosyaları
- `ui/overlay/`: overlay/canvas katmanı
- `shared/`: ortak tipler, UI state kontratları, data, host bridge

## Hedefler

- Büyük dosyaların her birini mümkünse 400-900 satır bandına çekmek.
- Public entrypoint davranışını korumak: `host/index.ts`, `ui/index.ts`, `host/runtime.ts`, `ui/repair-room-ui-runtime.ts` dış tüketicilere aynı kalmalı.
- ESM `.js` import uzantılarını ve type-only import düzenini korumak.
- Parçalama sırasında room source of truth olarak sadece `rooms/repair-room` altında çalışmak; build/installed kopyalara elle dokunmamak.

## Uygulama Sırası

### 1. Host Runtime Parçalama

Önce `rooms/repair-room/host/runtime.ts` küçültülür. Bu dosya en büyük ve en fazla sorumluluk taşıyan dosya.

Yeni önerilen klasör:

- `rooms/repair-room/host/runtime/`

Önerilen modüller:

- `runtime/guards.ts`: safe string/number/record, enum guardları, payload normalize yardımcıları
- `runtime/session-helpers.ts`: session listesi, aktif session, draft session, wizard patch
- `runtime/event-factory.ts`: snapshot, annotation, measurement, investigation event üreticileri
- `runtime/overlay-selection.ts`: image point/rect, overlay ref, selection/focus/nudge yardımcıları
- `runtime/storage-controller.ts`: hydrate, storage state, persist queue orkestrasyonu
- `runtime/operations-controller.ts`: capture, dictation, ambient, camera, TTS helperları
- `runtime/ai-controller.ts`: knowledge research, chat reply, tactical/measurement AI istekleri
- `runtime/command-router.ts`: `REPAIR_UI_COMMANDS` dispatch ve layout/viewport/timeline update adapterları

`host/runtime.ts` sonunda yalnızca `createRepairRoomHostRuntime` orkestratörü olarak kalmalı.

### 2. UI Runtime Parçalama

Sonra `rooms/repair-room/ui/repair-room-ui-runtime.ts` küçültülür.

Yeni önerilen klasör:

- `rooms/repair-room/ui/runtime/`

Önerilen modüller:

- `runtime/state.ts`: initial UI state ve meta factory
- `runtime/dom-utils.ts`: class/text/dataset/style update helperları
- `runtime/panel-lifecycle.ts`: panel signature, lifecycle, sync, dock layout helperları
- `runtime/shell.ts`: persistent shell, statusbar, legend, settings overlay shell
- `runtime/overlay-sync.ts`: overlay config/signature/sync ve spatial focus tween
- `runtime/actions.ts`: click/input/change event routing
- `runtime/keyboard.ts`: keydown, timeline scrub/jump, overlay shortcutları
- `runtime/host-message-handlers.ts`: host message normalize sonrası UI state mutationları

`ui/repair-room-ui-runtime.ts` public exportları korur:

- `REPAIR_DOCK_PANEL_IDS`
- `getRepairVisibleDockPanelIds`
- `getRepairDockGridTemplateColumns`
- `getRepairDockLayoutProjection`
- `createRepairRoomUiRuntime`

### 3. Overlay Stage Parçalama

`rooms/repair-room/ui/overlay/overlay-stage.ts` mevcut `overlay` klasöründe bölünür.

Önerilen modüller:

- `overlay/konva-loader.ts`: Konva global guard ve lazy load
- `overlay/overlay-renderers.ts`: grid, AI mark, annotation, measurement, region, relationship çizimleri
- `overlay/overlay-interaction.ts`: modifier, hover/focus/selected state ve opacity hesapları
- `overlay/overlay-sync.ts`: incremental group sync, fingerprint, prune helperları
- `overlay/overlay-stage-controller.ts`: stage lifecycle, resize, pointer/drag/wheel/keyboard binding

`overlay-stage.ts` sadece public tipleri ve `mountRepairOverlayStage` exportunu koruyan entrypoint olabilir.

### 4. Replay Projection Parçalama

`rooms/repair-room/host/state/repair-replay-projection.ts` projection alt klasörüne ayrılır.

Yeni önerilen klasör:

- `rooms/repair-room/host/state/projections/`

Önerilen modüller:

- `replay-events.ts`: event sorting, playhead, visible events, tactical feed
- `measurement-projection.ts`: reading/evidence/measurement state üretimi
- `spatial-projection.ts`: image rect, knowledge regions, investigation regions, temporary regions, spatial focus
- `relationship-projection.ts`: measurement relationships ve timeline density
- `guidance-projection.ts`: phase, next action, panel visibility, overlay saturation, focus corridor
- `operations-projection.ts`: operations, voice readiness, live source, continuity

Ana dosya sadece composition ve mevcut public exportları taşır.

### 5. CSS Parçalama

`rooms/repair-room/ui/style.css` entrypoint olarak kalır ve import sırası korunarak parçalara ayrılır.

Yeni önerilen klasör:

- `rooms/repair-room/ui/styles/`

Önerilen CSS dosyaları:

- `base.css`: reset, html/body, `#app`
- `shell.css`: shell, statusbar, workspace, generic panel
- `workbench.css`: stage, toolbar, viewport, camera/live/focus UI
- `session-rail.css`
- `tactical-feed.css`
- `wizard-knowledge.css`
- `timeline.css`
- `profile-settings.css`
- `chat-measurement-sync.css`
- `responsive.css`: media queries ve focus-mode son kuralları

Cascade riski nedeniyle CSS en sona alınmalı ve import sırası birebir kontrol edilmeli.

## Dikkat Edilecek Riskler

- `host/runtime.ts` closure-heavy; controller extraction sırasında context object net olmalı.
- TypeScript ESM importlarında `.js` uzantıları korunmalı.
- Type-only importlar runtime importa çevrilmemeli.
- Döngüsel bağımlılık riski özellikle `host/runtime/*` ve `shared/ui/state.ts` çevresinde kontrol edilmeli.
- UI incremental DOM update mantığında panel signature davranışı değişmemeli.
- Overlay fingerprint ve Map-based sync bozulursa stale layer veya gereksiz redraw oluşabilir.
- CSS parçalama sırasında cascade sırası ve responsive kuralların konumu korunmalı.

## Doğrulama Planı

Her büyük aşamadan sonra:

- `npm run rooms:typecheck`
- `npm run rooms:lint`
- `npm run rooms:test:file -- scripts/tests/repair-room-runtime-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/repair-room-overlay-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/repair-room-host-import-smoke-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/repair-room-ui-smoke-regressions.test.ts`

Son turda:

- `npm run rooms:test:core`
- `npm run typecheck`
- `npm run lint`
- `npm run rooms:build`

Manuel smoke checklist:

- Repair Room açılış ve render
- Session create, activate, archive, delete
- Wizard, AI research, knowledge pack attach
- Workbench overlay annotation, measurement pin, marquee select, focus/nudge
- Timeline replay, live, freeze-frame
- Chat ve AI room command handling
- Capture/dictation/TTS status mesajları
- Novice/advanced profile panel visibility ve focus corridor

## Önerilen İlk Uygulama Dilimi

İlk uygulama turunda sadece `host/runtime.ts` parçalanmalı. Bu dosya en yüksek bakım maliyetine sahip ve diğer parçalara göre testlerle daha net doğrulanabilir.

İlk dilim kapsamı:

- Guard ve normalize helperlarını `host/runtime/guards.ts` içine almak
- Event factory helperlarını `host/runtime/event-factory.ts` içine almak
- Session helperlarını `host/runtime/session-helpers.ts` içine almak
- `host/runtime.ts` public davranışını değiştirmeden importlara geçirmek
- Repair Room runtime ve host import smoke testlerini çalıştırmak

İlk dilim bittikten sonra kalan runtime controller parçaları daha güvenli çıkarılır.
