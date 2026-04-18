US1 üzerinden Game Room XOX, ayrılmış bir taşıma kontratı kullanır.

Yaşam döngüsü olayları konuşma zarfında `roomEvent` olarak taşınır:

- `invite`
- `accept`
- `reject`
- `reset`

Tur hamleleri `roomCommand` olarak taşınır ve e-posta gövdesinde tek bir `++cmd` satırı olarak da yansıtılır:

- `++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomXoxRemoteMove",...}})`

Canonical alanlar:

- `matchId`: tek bir uzak XOX maçı için kararlı kimlik
- `inviteId`: şu anda `matchId` ile aynı değeri taşıyan uyumluluk takma adı
- `turnIndex`: uygulanan hamleden önceki sıfır tabanlı hamle indeksi
- `boardHashBeforeMove`: hamle öncesi kompakt tahta özeti hash'i

Uzak hamle kontratı:

- Payload tam olarak bir hedef hücre içermelidir.
- `matchId` etkin XOX maçıyla eşleşmelidir.
- `turnIndex` yerelin beklediği tur indeksiyle eşit olmalıdır.
- `boardHashBeforeMove` hamle öncesindeki yerel tahta özetiyle eşleşmelidir.
- Tekrarlanan veya bayat taşıma mesajları tahtayı değiştirmeden yok sayılmalıdır.

Sıfırlama kontratı:

- `reset`, ilgili `matchId` için bekleyen veya etkin olan mevcut maçı sonlandırır.
- Reset yalnızca hedeflenen maç durumunu temizlemeli, başka uzak hesaplara ait ilgisiz davetleri kaldırmamalıdır.
