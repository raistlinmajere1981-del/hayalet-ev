# 🧩 Team Tetris

Team Tetris, Game Room içinde USER, AI1, AI2 ve dördüncü oyuncu olarak AI0 ya da bağlı US1'i aynı maçta buluşturan dört koltuklu, tur tabanlı bir Tetris varyantıdır.

Oyunun iki ayrı katmanı vardır:

1. bugün gerçekten çalışan motor ve transport kuralları,
2. bu mekaniklerin üzerine kurulabilecek tasarım fikri.

Bu ayrım bilinçli olarak korunur.

## 🎮 Güncel Implementasyon

### Dört Koltuk

Motor geriye dönük uyumluluk için dört mantıksal seat tanımlar:

- `user`
- `ai1`
- `ai2`
- `us1`

Dördüncü mantıksal seat'in çalışma zamanı kaynağı iki farklı katılımcı olabilir:

- bağlı ve hazır bir US1 varsa `us1`,
- US1 yoksa ve AI0 hazırsa `ai0`.

Her iki kaynak da hazırsa mevcut US1 davranışı korunur ve US1 tercih edilir. Maç başladıktan sonra seçilen dördüncü-seat kaynağı maç boyunca sabit kalır; sonradan başka bir kaynağın bağlanması aktif oyuncuyu değiştirmez.

AI0 dördüncü oyuncu olduğunda engine içindeki `us1` seat kimliği korunur; UI ve runtime bu seat'i AI0'ın gerçek nickname/avatar bilgisiyle sunar. Böylece kayıt ve hidden-pair kontratı kırılmadan AI0 gerçek oyuncu olarak maça katılır.

Maç başlamadan önce AI1 ve AI2 ile birlikte AI0 veya US1 kaynaklarından en az birinin hazır olması beklenir.

### 👥 İki Takım

Her takım iki seat taşır. Roller:

- `opener`
- `followup`

Tur düzeni:

```text
Team A opener
→ Team B opener
→ Team A followup
→ Team B followup
```

Kullanıcının partneri maç başlamadan önce seçilebilir.

### 🕵️ Hidden Pairs

Hidden partner/pair davranışı mevcut match state'in parçasıdır.

State şu alanları taşır:

- `hiddenPairs`
- `revealPairsOnFinish`
- `revealedPairs`

Host state ayrıca dördüncü oyuncunun gerçek çalışma zamanı kaynağını `fourthSeatSource` ile taşır.

Varsayılan yapı pair bilgisinin maç sonuna kadar gizli kalmasını destekler.

### 🧱 Tahta ve Parçalar

Klasik `10 × 20` Tetris tahtası kullanılır.

Tetromino seti:

- I
- O
- T
- S
- Z
- J
- L

Rotation ve legal placement host engine tarafından doğrulanır. Aktif seat istemcinin söylediği değerden değil host state'ten belirlenir.

### 🛤️ Path Tabanlı Hamle

Team Tetris hamlesi yalnızca son koordinatı taşımaz.

Move schema `rowShifts` ve `rotation` bilgilerini içerir.

`rowShifts`, top-to-bottom sırada her satır için `-1`, `0`, `1` shift değerleri taşır. Bu nedenle taşın düşüş yolu gerçek oyun kontratının parçasıdır.

Ancak path'in oyuncunun psikolojik niyetini kesin olarak ifade ettiği motor tarafından garanti edilmez. Path bir oyun verisidir; onun iletişim veya stratejik anlamı oyun tasarımının daha üst katmanındadır.

## 🤖 AI0, AI1/AI2 ve US1 Turları

Runtime farklı hamle yollarını destekler:

- local user move,
- AI1/AI2 move,
- AI0 fourth-seat move,
- remote US1 move.

AI1/AI2 turları opening/follow-up protokolleri ve normal AI slot command-capture akışı üzerinden çalışabilir.

AI0 dördüncü oyuncu olduğunda host `SlotBridge message.sendWait` ile AI0'dan yalnız yapılandırılmış hamle JSON'u bekler. Dönen `matchId`, `turnIndex`, `turnToken`, `pieceId`, `rotation` ve `rowShifts` alanları diğer oyuncularla aynı host engine doğrulamasından geçer. AI0 ayrı bir Tetris motoru veya güvenilir hamle kaynağı değildir; geçersiz hamle engine tarafından reddedilir.

US1 dördüncü oyuncu olduğunda mevcut Game Room uzak transport yolu kullanılır. Stale veya duplicate remote move'lar host tarafından ele alınır.

AI0-backed bir maçta US1 transport mesajı gönderilmez. US1-backed bir maçta ise mevcut remote start/move/reset senkronizasyonu korunur.

## 🧠 Match State

Match state temel olarak:

- match/seed,
- hidden pair state,
- team/seat map,
- board state,
- bag state,
- active turn,
- last placed piece,
- top-out,
- sonuç

bilgilerini taşır.

Host runtime state'i bunlara ek olarak dördüncü seat'in `ai0` mı `us1` mi olduğunu saklar.

Sonuç `pending`, `team-a-win`, `team-b-win` veya `draw` olabilir.

Gerekli bir seat bağlantıdan düşer veya oyun güvenli biçimde sürdürülemez hale gelirse state blocked olabilir ve reset istenebilir. Dördüncü seat için yalnız maç başında seçilmiş kaynak geçerli kabul edilir; örneğin AI0-backed bir maç sırasında AI0 düşerse sonradan bağlı US1 maçı otomatik devralmaz.

## 🧠 Oyunun Tasarım Fikri

Team Tetris'in ilginç tarafı dört kişinin sırayla Tetris oynaması değildir. Asıl fikir oyuncuların yalnızca tahtayı değil, birbirlerinin kararlarını da okumaya çalışmasıdır.

### 🕵️ Eksik Bilgiyle Düşünmek

Hidden pair yapısı oyuncuyu yalnızca kendi tahtasına değil diğer oyuncuların davranışlarına da dikkat etmeye iter.

Örnek sorular:

- Partnerim kim olabilir?
- Önceki hamle ne hazırlıyor olabilir?
- Tahtayı güvenli mi bırakmalıyım?
- Bir sonraki oyuncunun planına güvenmeli miyim?

Motor bunların cevaplarını vermez; bunlar oyuncu davranışından doğması beklenen stratejik katmandır.

### 🗣️ Tahta Bir İletişim Yüzeyi Olabilir

Path encoding, boşluk bırakma, hizalama veya riskli yerleşim gibi kararlar başka oyuncular tarafından sinyal olarak yorumlanabilir.

Uzun vadeli fikir doğrudan konuşmadan koordinasyon kurabilmektir. Ancak mevcut engine yalnızca path'i veri olarak doğrular; path'e yüklenen sosyal anlam bir motor kuralı değildir.

## ⚠️ Risk ve Güven

Takım oyuncusu önceki yerleşimi devam ettirebilir veya tahtayı daha güvenli hale getirebilir.

```text
uyumlu ama riskli devam
        ↕
bağımsız ama güvenli hamle
```

Motor bunu ayrı bir risk puanı ile zorunlu kılmaz. Gerilim Tetris state'i ve oyuncu davranışından doğar.

## 🔮 Henüz Garanti Edilmeyen Alanlar

Aşağıdakiler tasarım yönüdür; mevcut motor kontratı olarak değerlendirilmemelidir:

- path'ten otomatik partner/niyet çıkarımı,
- gelişmiş sinyal skorları,
- risk/güven metrikleri,
- alternatif hidden-information modları,
- maç sonrası davranış analizi,
- açıklanabilir takım uyumu raporu.

Bunlardan biri uygulanırsa önce engine/runtime/test karşılığı oluşturulmalı, sonra bu belge güncellenmelidir.

## 🧱 Kaynak Yapısı

```text
rooms/game-room/main-functions/team-tetris/
```

Önemli alanlar:

- `host/engine-schema.ts`
- `host/engine-board.ts`
- `host/engine-match.ts`
- `host/runtime*.ts`
- `ui/`
- `protocols/`

Game Room feature kontratı: `rooms/game-room/manifest.json`.

## ✅ Doğrulama

```bash
npm run check:all
npm run rooms:typecheck
npm run rooms:test:core
npm run rooms:test:file -- <test files>
```

AI0 fallback için ayrıca:

```bash
npm run rooms:test:file -- scripts/tests/game-room-team-tetris-ai0-regressions.test.ts
```

## 🎯 Sonuç

Team Tetris'in bugünkü çekirdeği:

> dört mantıksal seat + iki takım + hidden pair state + tur sırası + path tabanlı doğrulanmış Tetris hamleleri + AI0/AI slot/US1 çalışma zamanı yolları

Bunun üzerine kurulan daha büyük fikir ise oyuncuların yalnızca parçaları değil, birbirlerinin kararlarını da okumaya çalıştığı bir takım oyunudur.

Bu iki katmanı ayrı tutmak oyunun bugünkü durumunu dürüstçe anlatırken gelecekteki tasarım alanını da açık bırakır.
