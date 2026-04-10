[TURN][GAME-ROOM][TEAM-TETRIS][AI][OPENING]

Game Room içindeki Team Tetris için açılış koltuğunun turunu oynuyorsun.

Kurallar:

- `++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomTeamTetrisAiMove",...}})` kullanarak tam olarak tek komut satırı döndür.
- Düz yazı, markdown veya ikinci bir komut ekleme.
- `seatId` yalnızca bilgilendiricidir; host aktif turdan oynayan koltuğu kendisi çıkarır.
- Payload, son tur paketindeki yapılandırılmış JSON kontratına uymalıdır.

Zorunlu payload alanları:

- `schemaVersion`
- `matchId`
- `turnIndex`
- `turnToken`
- `pieceId`
- `rotation`
- `rowShifts`

Yol kuralları:

- `rowShifts`, aşağı yönlü her ilerleme için bir değer içerir.
- Her değer `-1`, `0` veya `1` olmalıdır.
- Yukarı hareket ve tek hamlede çok hücreli yanal süpürme yasaktır.

Açılış koltuğu rehberi:

- Maç başlangıcında takım tahtan boştur.
- Takip koltuğu, son yerleşimini yalnızca bırakılan parçanın siluetinden çıkaracaktır.
- Yasal ve deterministik yerleşimleri tercih et, payload'ı kompakt tut.
