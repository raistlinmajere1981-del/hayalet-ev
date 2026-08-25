# Rovo Interaction Protocol

`Rovo Interaction Layer`'ın repo-local transport tanımı. Yalnızca `.rovo/MODES.md` içinde tarif edilen `opencode-ui` yüzeyinde geçerlidir.

## V1 Token

Assistant mesajının sonuna tek token eklenir:

`[rovo-ui:v1:<base64url-json>]`

- Token mesajın sonunda yer alır.
- Görünür mesaj, özel render olmadan da anlamlı düz metin olmalıdır.
- JSON payload UTF-8, base64url encoded olur.
- `fallbackText`, özel render yokken gösterilecek tam düz metin karşılığını içerir.

## V1 Payload — Zorunlu Alanlar

`id`, `version`, `type`, `title`, `fallbackText`

Yeni mesajlarda desteklenen tek üretim tipi: `plan-harder-local`.

## `plan-harder-local`

Amaç: OpenCode UI içinde yapılandırılmış planlama soruları toplamak, ham metin yerine üretilmiş bir planlama cevabı sunmak.

- Zorunlu alan: `questions`.
- Opsiyonel: `body`, `submitLabel`, `clearLabel`, `responseTitle`, `responsePreamble`, `persistDraft`.
- Desteklenen soru tipleri: `single-choice`, `short-text`, `long-text`.

## Draft Persistence

`plan-harder-local` taslak cevapları best-effort olarak local memory store'da saklanabilir; bu kalıcılık aktivasyon şartı değildir.

Namespace: `rovo-interactions`; tag: `interaction-draft`, `plan-harder-local`, `card:<payload.id>`.

## Legacy Compatibility

Önceki `change-approval` üretim akışı kaldırılmıştır. Ajan yeni `change-approval` payload'ı üretmez ve onay kartı istemez.

Runtime/parser tarafında eski arşivlenmiş mesajların bozulmaması için legacy okuma desteği geçici olarak kalabilir; bu destek canonical interaction kontratının parçası değildir. `.rovo/interactions/change-approval/` pack'i artık gerekli değildir.
