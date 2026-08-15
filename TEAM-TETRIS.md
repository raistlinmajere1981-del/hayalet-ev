# Team Tetris

Team Tetris, Game Room içinde USER, AI1, AI2 ve bağlı US1'i aynı maçta buluşturan dört koltuklu, tur tabanlı bir Tetris varyantıdır.

Bu belge iki şeyi birbirinden ayırır:

1. **Güncel implementasyon** — motor ve transport katmanında bugün gerçekten çalışan kurallar.
2. **Tasarım yönü** — bu mekaniklerin neden var olduğu ve ileride nasıl derinleştirilebileceği.

Bu ayrım özellikle önemlidir; tasarım fikri, uygulanmış oyun kuralı gibi belgelenmemelidir.

---

## Güncel Implementasyon

### Dört koltuk

Motor dört seat tanımlar:

- `user`
- `ai1`
- `ai2`
- `us1`

Maç başlamadan önce gerekli AI/US1 koltuklarının hazır olması beklenir.

Game Room manifesti kullanıcı, AI1, AI2 ve bağlı US1 için dört-seat turn-based Team Tetris akışını aktif özellik olarak tanımlar.

### İki takım, opener ve followup

Her takım iki seat taşır ve iki rol kullanır:

- `opener`
- `followup`

Tur döngüsü takım A opener → takım B opener → takım A followup → takım B followup düzenini izler.

Kullanıcının partneri maç başlamadan önce seçilebilir. Motor partner/team eşleşmesini match state içinde tutar.

### Hidden pairs

Hidden partner/pair davranışı yalnızca gelecek fikri değildir; mevcut match state'in parçasıdır.

Motor şu alanları taşır:

- `hiddenPairs`
- `revealPairsOnFinish`
- `revealedPairs`

Varsayılan state hidden pair davranışını açık tutar ve eşleşmelerin maç sonunda açılmasını destekler.

Bu özellik takım bilgisinin UI/protocol tarafında ne kadar görünür olacağını belirleyen oyun durumunun parçasıdır.

### Tahta ve parçalar

Motor klasik 10×20 Tetris tahtası kullanır.

Desteklenen tetromino seti:

- I
- O
- T
- S
- Z
- J
- L

Rotation ve legal placement kuralları host engine tarafından doğrulanır; seat kimliği istemci cevabına güvenilerek değil host tarafından aktif turdan türetilir.

### Path tabanlı hamle

Team Tetris hamlesi yalnızca “son x koordinatı” şeklinde taşınmaz.

Move schema path bilgisini `rowShifts` biçiminde kodlar:

- satır sırası top-to-bottom,
- her satır adımı için `-1`, `0`, `1` shift,
- rotation bilgisi,
- host tarafından doğrulanan aktif turn/seat bağlamı.

Bu nedenle düşüş yolu gerçek implementasyonda veri kontratının parçasıdır.

Ancak “düşüş yolu oyuncunun psikolojik niyetini kesin olarak ifade eder” yorumu bir **oyun tasarımı fikridir**; motor bunu semantik iletişim kuralı olarak zorunlu kılmaz.

### AI ve US1 turları

Manifest/runtime katmanında ayrı hamle yolları bulunur:

- local user move,
- AI1/AI2 move,
- remote US1 move.

AI turları açılış ve follow-up protokolleri üzerinden çalışabilir. US1 hamleleri Game Room'un room transport akışı üzerinden gelir.

Stale veya duplicate remote move'lar ile yanlış seat'ten gelen provider cevapları host tarafında ele alınır.

### Maç durumu

Match state temel olarak şunları taşır:

- match/seed bilgisi,
- hidden pair durumu,
- team/seat map,
- her takımın board ve bag state'i,
- aktif turn,
- son yerleştirilen parça,
- top-out bilgisi,
- sonuç: pending / team-a-win / team-b-win / draw.

Bir gerekli seat bağlantıdan düşerse veya geçersiz/iletilemeyen hamle maçı güvenli biçimde sürdürülemez hale getirirse state blocked duruma alınabilir ve reset istenebilir.

---

## Oyunun Tasarım Fikri

Team Tetris'in ilginç tarafı dört oyuncunun sırayla Tetris oynaması değil, sınırlı bilgi altında takım uyumu üretme potansiyelidir.

Aşağıdaki maddeler motorun ham veri yapısından çok oyunun **tasarım yönünü** anlatır.

### Eksik bilgiyle düşünmek

Hidden pair yapısı oyuncunun yalnızca tahtaya değil diğer oyuncuların kararlarına da dikkat etmesini mümkün kılar.

Amaç şu soruları doğurabilecek bir oyun alanıdır:

- Hangi oyuncu benim partnerim olabilir?
- Bir önceki hamle hangi planı hazırlıyor olabilir?
- Güvenli oynayıp tahtayı mı korumalıyım, yoksa gördüğüm plana güvenip risk mi almalıyım?

Bu çıkarımlar motor tarafından “doğru cevap” olarak hesaplanmaz; oyun davranışından doğması beklenen stratejik katmandır.

### Tahta bir iletişim yüzeyi olabilir

Path encoding, boşluk bırakma, hizalama ve riskli yerleşim gibi kararlar oyuncular arasında dolaylı sinyal haline gelebilir.

Bu nedenle Team Tetris'in uzun vadeli fikri doğrudan sohbetten çok **oyun davranışı üzerinden koordinasyon** kurmaktır.

Ancak bugün belgelenmesi gereken kesin kontrat şudur: motor path'i hamlenin bir parçası olarak taşır ve doğrular. Path'e yüklenen sosyal/stratejik anlam oyuncuların ve gelecekteki oyun tasarımının alanıdır.

### Risk ve güven

İki kişilik takımlarda sıradaki oyuncu önceki yerleşimin devamını getirebilir veya tahtayı daha güvenli bir duruma çekebilir.

Bu seçim Team Tetris'in hedeflediği temel gerilimdir:

- uyumlu ama riskli devam,
- daha bağımsız ama güvenli hamle.

Motor bu tercihi özel bir “risk puanı” kuralıyla zorunlu kılmaz; bu, Tetris durumu ve oyuncu davranışından doğan oyun dinamiğidir.

---

## Henüz Garanti Edilmeyen / Gelecek Tasarım Alanları

Aşağıdaki fikirler Team Tetris'in doğal genişleme alanlarıdır ancak güncel motor kontratının zorunlu parçası olarak kabul edilmemelidir:

- path davranışından otomatik niyet/partner çıkarımı,
- oyuncular arası gelişmiş sinyal skorları,
- özel risk/güven metrikleri,
- alternatif hidden-information modları,
- maç sonrası davranış analizi veya açıklanabilir takım uyumu raporu.

Bu özelliklerden biri uygulandığında önce engine/runtime/test karşılığı oluşturulmalı, ardından bu belge “güncel implementasyon” bölümünde güncellenmelidir.

---

## Kaynak Yapısı

Team Tetris Game Room içinde yaşar:

`rooms/game-room/main-functions/team-tetris/`

Önemli alanlar:

- `host/engine-schema.ts` — board, seat, piece ve move schema sabitleri
- `host/engine-board.ts` — board/placement kuralları
- `host/engine-match.ts` — team, partner, turn ve match state
- `host/runtime*.ts` — AI/US1 turn ve transport davranışları
- `ui/` — oyun yüzeyi ve path seçimi
- `protocols/` — AI opening/follow-up ve US1 transport protokolleri

Game Room feature kontratı: `rooms/game-room/manifest.json`.

---

## Doğrulama

Game Room veya Team Tetris değişikliklerinden sonra ilgili regressions ile birlikte repository kalite kapısı çalıştırılmalıdır:

```bash
npm run check:all
```

Room odaklı doğrulama için:

```bash
npm run rooms:typecheck
npm run rooms:test:core
```

Feature'a özel regressions için `npm run rooms:test:file -- <test files>` kullanılabilir; tüm regression seti `npm run test:all` ile çalıştırılabilir.

---

## Sonuç

Team Tetris'in bugün çalışan çekirdeği nettir:

> dört seat + iki takım + hidden pair state + tur sırası + path tabanlı doğrulanmış Tetris hamleleri + AI/US1 transport.

Bunun üzerine kurulmak istenen daha büyük fikir ise oyuncuların yalnızca parçaları değil, birbirlerinin kararlarını da okumaya çalıştığı bir takım oyunudur.

Bu iki katmanı ayrı tutmak, oyunun mevcut durumunu dürüstçe belgelemeye ve tasarım alanını kaybetmeden geliştirmeye izin verir.
