# Agent Profile Registry — Aşama 1

Canonical kayıt `Paths.getDataDir()/shared/app.db` içindedir. Hesap arşivlerinden ve OpenCode'un kendi veritabanından bağımsızdır; WAL ve foreign key kullanır. `agent_profiles`, `agent_character_features`, `agent_instructions` ve `agent_profile_selections` kişiliği, talimat içeriğini ve kapsam seçimini saklar. İlk açılışta beş başlangıç profili eklenir; silinen kayıtlar yeniden oluşturulmaz. JSON import, migration, Markdown kişilik kaydı ve çift yazma yoktur. Git'teki başlangıç tanımları yalnız boş registry'nin seed kaynağıdır; çözümleme SQLite içeriğini kullanır.

`AgentProfileRegistry` profil ve talimat CRUD işlemlerini, editörün atomik kayıt işlemini ve çözümlemeyi sağlar. Editör revision ve tekil kayıtlarda version çakışmaları sessiz veri kaybını önler. Profil açıklaması editör notudur; sistem talimatına eklenmez. Karakter editörü görev talimatı bağlantısını ve istenen yetenekleri değiştiremez.

Kapsam `(purpose, agentId, roomId, roleId)` tuple'ıdır. `purpose` açıkça `development` veya `runtime` olur. Seçimler başka agent, oda, rol veya purpose kapsamına taşınmaz. Seçim yapılmamış kapsam Normal profilini kullanır; Normal silinmişse açık profil seçimi gerekir. Göreve bağlı profiller yalnız kendi purpose ve rolünde seçilir.

Çözümleme sırası: temel talimat → agent → oda → görev/rol → karakter özellikleri. Bu sıra birleşim sırasıdır; karakter tercihleri görev sınırlarını ve araç yetkisini değiştiremez. Talimatlar scope'a göre okunur; hiçbir çözümleyici geliştirme AGENTS.md, `.rovo`, memory, OpenCode config veya gizli oyun state'i okumaz. Repository AGENTS.md, bu projede çalışan geliştirme ajanının çalışma protokolüdür ve runtime policy olarak import edilmez.

Çıktı resolverVersion, katman/özellik sürümleri ve SHA-256 hash içerir. Hash, canonical kapsamı, çözülmüş içeriği ve host yetenek snapshot'ını kapsar. Aynı içerik/kapsam aynı hash'i üretir. Sistem talimatı 16.000 karakteri aşarsa çözümleme hata verir; izolasyon talimatları kırpılmaz.

`attestAgentCapabilities` yalnız host adaptörlerine açıktır. Renderer request'leri yetenek bildiremez. Snapshot belirli kapsam içindir, model değişiminde host tarafından yenilenir ve araç listesi önceki modelden birleştirilmez. Doğrulanmayan araç envanteri boş gösterilir. Profildeki `requestedCapabilities` bir gereksinimdir, izin değildir. OpenCode UI mesaj transportunun sistem talimatı desteği bilinir; bu aşamada model ve araç envanteri doğrulanmış sayılmaz.

`resolveAgentProfile` host'a doğrudan sistem talimatı sağlar. `prepareAgentProfileWorkspace` gerektiğinde repository dışındaki `Paths.getAi0RuntimeRoot()` altında yeni, boş bir çalışma alanına AGENTS.md üretir. Her üretim farklı bir dizin kullanır; repository AGENTS.md üzerine yazılmaz, `.rovo` veya mevcut bir agent çalışma alanı kopyalanmaz. Bu API bir runtime başlatmaz. İkinci aşamadaki host adaptörü, server config/MCP/permission/çevre izolasyonunu sağlamalı ve model/araç snapshot'ını gerçek oturumdan doğrulamalıdır. Prompt metni araç izinlerinin güvenlik sınırı değildir.

Asistan karakter editörü registry üzerinden oluşturma, düzenleme, silme ve kapsam seçimini kaydeder. OpenCode UI her mesajdan önce kayıtlı Asistan/AI0 profilini çözüp mevcut interaction sistem talimatıyla birlikte gönderir. Var olan geliştirme oturumunun geçmişi değiştirilmez. AI1/AI2 ve oda host'ları aynı API'yi kullanabilir; bu aşama her web provider'a otomatik talimat enjekte etmez.

Ortak `ServerCommands` catalog'una dört komut eklenmiştir:

- `++cmd:AgentProfileList`
- `++cmd:AgentProfileSelect(profileId, agentId, roomId, roleId, purpose)`
- `++cmd:AgentProfileInspect(agentId, roomId, roleId, purpose)`
- `++cmd:AgentProfileCapabilities(agentId, roomId, roleId, purpose)`

Komutlar mevcut slot kategorisi ve disabled-command kontrolünden geçer. Varsayılan kapsam runtime, komutu veren AI slotu, default oda ve default roldür. Örneğin NPC seçimi: `++cmd:AgentProfileSelect(fate-knots-npc, ai0, fate-knots, fate-knots-npc, runtime)`. Geliştirme asistanı seçimi: `++cmd:AgentProfileSelect(serious, ai0, assistant, default, development)`.

Fate Knots AI0 NPC ve image-worker servisleri değiştirilmemiştir. İkinci aşama: bu servislerin ortak AI0 host'a taşınması, scope/config/MCP izolasyonunun launch sırasında uygulanması, gerçek model/araç envanterinin doğrulanması ve registry çözümünün runtime/görsel üretim isteklerine bağlanması.

Ortak host entegrasyonu ve canlı kabul sınırları: [Ortak AI0 Runtime](ai0-runtime.md).
