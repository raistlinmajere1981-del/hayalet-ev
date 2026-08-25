# MEMORY.md

MCP Shared Memory kuralları. Aynı anda tek asistan aktif olur ama farklı provider'lar zaman içinde aynı hafızayı paylaşır; bu yüzden yazım disiplini önemlidir.

## Akış

1. **Session başı (1 kez):** `hev_memory_bootstrap_policy{ namespace: "policy" }`
2. **Arama (ihtiyaca göre):** `hev_memory_search{ namespace: "global", query, response_format: "prompt_compact", budget_chars: 1000-1600 }`
3. **Yazma (eşik bazlı):** kalıcı karar / kullanıcı tercihi / tekrar kullanılacak teknik bulgu varsa `hev_memory_write`. Şunlarda yazma zorunlu: MCP tool hatası, MCP için geliştirme ihtiyacı tespiti, eksik dependency/tool. Trivial tek seferlik işlerde yazmaya gerek yok.
4. **Düzeltme:** yanlış/eski bir kayıt fark edilirse `hev_memory_update{ id, ... }`.
5. **Bakım (periyodik, görev sonu değil):** `hev_memory_stats` / `hev_memory_prune{ max_items: 500, older_than_days: 30 }`.

## Policy Bootstrap

`hev_memory_bootstrap_policy` canonical policy belgelerini shared memory'ye senkronize eder. Varsayılan liste:

- `AGENTS.md`
- `.rovo/MODES.md`
- `.rovo/WORKFLOWS.md`
- `.rovo/MEMORY.md`
- `.rovo/03-ARCHITECTURE.md`

Bootstrap yalnız sync işlemdir; bu belgelerin tamamını session prompt'una yüklemek anlamına gelmez. Canonical listeden çıkarılan eski `system-policy` kayıtları sonraki bootstrap sırasında temizlenir.

## Namespace'ler

- `policy` — AGENTS.md/.rovo kuralları (pinned); canonical belgeler değiştiğinde bootstrap ile güncellenir.
- `global` — provider-bağımsız kalıcı gerçek/tercih/karar.
- `session-<id>` — gerekirse geçici, o session'a özel alan.

## Format

- Varsayılan `response_format: "prompt_compact"`; `json` yalnızca debug için.

## Yazım Kuralları

- Tek kayıt = tek atomik bilgi, 1-2 cümle.
- En az 2 tag (`domain`, `intent` gibi).
- `importance` 1-5; gerçekten kritik değilse 5 verme.
- **Asla yazma:** API key/token/credential/kişisel sır.
- **Yazmaya değmez:** log özeti, geçici debug adımı, tek kullanımlık komut çıktısı, transkript dump.
