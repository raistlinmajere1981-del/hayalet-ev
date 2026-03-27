# Game Room Card RPG v1 Spec

## Amaç

Hayalet Ev içindeki `game-room` odasına, mevcut oyunlardan bağımsız çalışan ikinci büyük oyun sistemi olarak kart tabanlı bir anlatı / FRP motoru eklenmesi.

Bu sistem:

- `game-room` içinde yeni bir oyun olarak çalışacak
- Hayalet Ev çekirdeğinden mantıksal olarak bağımsız olacak
- Hayalet Ev ile yalnızca mevcut yaklaşımda olduğu gibi `++cmd` komutları üzerinden iletişim kuracak
- ilk sürümde sade, çalışır ve genişletilebilir bir iskelet kuracak
- senaryo, asset ve içerik genişletmesi sonradan kolayca yapılabilecek şekilde tasarlanacak

Bu görevde amaç “tam oyun” değil, **ilk çalışan motor + UI + asset entegrasyon iskeleti** oluşturmaktır.

---

# 1. V1 Kapsamı

## V1’de olacaklar

- `game-room` içine yeni oyun entegrasyonu
- ayrı oyun motoru
- ayrı state modeli
- `++cmd` tabanlı oyun komutları
- karakter oluşturma ekranı
- lobby / ready ekranı
- ana senaryo ekranı
- combat ekranı
- kart tabanlı seçim sistemi
- basit motor tabanlı combat sistemi
- dış klasörlerden gelen assetlerin oyunda kullanılması
- dış json/manifest yapılarından asset ve içerik okunması
- ilk senaryoyu destekleyecek kadar veri modeli
- temel map/lokasyon akışı
- oyuncu seçimlerinin toplanması
- ortak karar mantığı (ilk sürümde sade yaklaşım)
- saveable / serializable state temel yapısı

## V1’de olmayacaklar

- gelişmiş açık dünya
- çoklu senaryo zinciri
- world builder AI entegrasyonu
- runtime DM AI entegrasyonu
- NPC memory / Rovo bazlı oynayan NPC sistemi
- gelişmiş paralel oyuncu ayrışması
- gelişmiş loot ekonomisi
- ileri seviye combat dengesi
- procedural story generation
- büyük particle / ağır animasyon sistemi
- fazla sayıda oyun modu
- içerik editörü

---

# 2. Temel Mimari Yaklaşım

Yeni oyun, `game-room` içindeki mevcut feature modeline uygun şekilde eklenecek.

Önerilen mantık:

- `game-room` feature kayıtlarına yeni oyun eklenir
- host / main-functions yapısında ayrı modül olarak yer alır
- mevcut oyunlardan bağımsız olur
- state ve engine ayrı dosyalarda tutulur
- asset ve içerik yükleme sistemi ayrı katmanda çalışır
- host tarafı yalnızca komut köprüsü ve oda entegrasyonunu yapar
- motor kendi mantığını kendi içinde yönetir

## Yüksek seviye yapı

- `CardRpgEngine`
- `CardRpgState`
- `CardRpgCommandBridge`
- `CardRpgAssetRegistry`
- `CardRpgContentLoader`
- `CardRpgUIRenderer`
- `CardRpgCombatEngine`

---

# 3. Hayalet Ev ile Sınır

Hayalet Ev tarafı:

- slotları bilir
- oyunu başlatır
- oyunu seçtirir
- `++cmd` ile mesaj taşır
- UI kabuğunu barındırır

Card RPG tarafı:

- karakter yaratmayı bilir
- kartları bilir
- sahne state’ini bilir
- combat state’ini bilir
- assetleri bilir
- JSON/manifest içeriklerini bilir
- oyuncu aksiyonlarını çözer

Bu sınır korunmalıdır.

Yeni oyun, Hayalet Ev içinde çalışan ama oyun mantığını kendi içinde taşıyan bağımsız alt sistem gibi düşünülmelidir.

---

# 4. Komut Sistemi

Hayalet Ev ile yeni oyun arasındaki iletişim yalnızca `++cmd` üzerinden kurulacaktır.

## Örnek komut ailesi

Gerçek isimlendirme repo konvansiyonuna göre uyarlanabilir ama mantık şu olmalı:

- `++cmd:GameRoomCardRpgStart(...)`
- `++cmd:GameRoomCardRpgReset()`
- `++cmd:GameRoomCardRpgReady(...)`
- `++cmd:GameRoomCardRpgCharacterSelect(...)`
- `++cmd:GameRoomCardRpgChoice(...)`
- `++cmd:GameRoomCardRpgChat(...)`
- `++cmd:GameRoomCardRpgCombatAction(...)`
- `++cmd:GameRoomCardRpgSync(...)`
- `++cmd:GameRoomCardRpgEnd()`

## Komut ilkeleri

- payload JSON taşıyabilmeli
- parser güvenli olmalı
- invalid payload durumunda oyun düşmemeli
- stale / duplicate command toleransı olmalı
- slot bazlı doğrulama yapılmalı

---

# 5. Oyun Akışı

## 5.1 Lobby / Ready Screen

Oyuncular oyuna giriş yaptığında:

- ana harita görünür
- bağlı katılımcılar görünür
- ready durumları görünür
- oyun başlat butonu görünür

Başlatma için gerekli katılımcılar:
- local user
- AI1
- AI2
- US1

İlk sürümde 4 kişilik yapı hedeflenir.

## 5.2 Character Creation

Oyun başladıktan sonra:

- oyuncular avatar seçer
- sınıf seçer
- geçmiş seçer
- temel karakter seçimlerini tamamlar
- ready olur

İlk sürümde sınırlı başlangıç seçenekleri vardır.

## 5.3 Main Scenario Screen

Karakter oluşturma sonrası:

- sahne görseli
- sahne metni
- seçenekler
- oyuncu kartları
- log / konuşma alanı
- karakter durumu

aynı ekranda gösterilir.

## 5.4 Combat

Combat başladığında:

- UI combat moduna geçer
- combat tamamen motor tarafından yürütülür
- combat kartları kullanılır
- basit stat + zar + kart formülü çalışır
- sonuçlar log olarak üretilir
- combat sonucu tekrar anlatı state’ine bağlanır

İlk sürümde DM / AI combat çözümlemesine dahil edilmez.

---

# 6. Combat Sistemi

Combat v1 motor tabanlı ve sade olacaktır.

## Temel prensip

- combat hesaplanır
- hikaye sonradan anlatılır
- combat sonucu state’e yazılır

## Temel statlar

- HP
- attack
- defense
- speed
- luck

## Combat config dış dosyadan okunur

Motor combat denklemlerini ve temel kuralları harici dosyadan okuyacaktır.

Bu sayede:
- balans sonradan değiştirilebilir
- kod değiştirmeden ince ayar yapılabilir

## Combat kartları

İlk sürüm için minimum combat kart seti kullanılacaktır:

- Strike
- Quick Strike
- Heavy Blow
- Risk Strike
- Guard
- Dodge
- Counter
- Focus
- Position
- Recover
- Poison
- Stun

İlk sürüm için sade ama test edilebilir bir combat yapısı yeterlidir.

---

# 7. Asset Sistemi

Assetler oyun motorundan ayrı, klasör bazlı ve manifest/json bazlı okunacaktır.

Kod içinde büyük sabit görsel tanımları tutulmamalıdır.

## Asset pipeline mantığı

- ham batch görseller dışarıda üretilir
- script ile slice edilir ("npm run assets:process")
- json mapping ile isimlendirilir
- normalize edilir
- hedef klasörlere kaydedilir
- oyun motoru bu klasörlerden ve metadata’dan yükler

## Batch json standardı

Her batch yanında şu mantıkta bir json bulunur:

```json
{
  "source": "batch_name.png",
  "outputDir": "assets/processed/cards/items",
  "outputFormat": "webp",
  "target": {
    "width": 512,
    "height": 512,
    "fit": "contain",
    "padding": 32
  },
  "items": [
    {
      "id": "item_example",
      "name": "Example Item",
      "tags": ["item"],
      "index": 0
    }
  ]
}

Fit kuralları
contain
item
npc
creature
avatar
icon
overlay
UI element
cover
full scene backgrounds
full map backgrounds
8. V1 Asset Seti

Aşağıdaki asset grupları v1 için hazır kabul edilmelidir ve sistem bunları kullanacak şekilde tasarlanmalıdır.

8.1 Cards / Entities
items
npcs
creatures
avatars
class icons
background icons
location card arts
8.2 World
full map
village gate scene
old well square scene
inn interior scene
8.3 UI Core
ui frames
card templates
buttons
dialogue UI
combat icons
overlays
map interactions
card interaction overlays
status ui
8.4 Asset klasör mantığı

Aşağıdaki klasör mantığına yakın, repo yapısına uygun bir sistem kurulmalı:

assets/processed/cards/items
assets/processed/cards/npcs
assets/processed/cards/creatures
assets/processed/cards/avatars
assets/processed/cards/class-icons
assets/processed/cards/background-icons
assets/processed/cards/locations
assets/processed/scenes
assets/processed/maps
assets/processed/ui/buttons
assets/processed/ui/frames
assets/processed/ui/dialogue
assets/processed/ui/combat-icons
assets/processed/ui/overlays
assets/processed/ui/map
assets/processed/ui/card-effects
assets/processed/ui/status

Gerçek dosya yolları repo standardına göre ayarlanabilir.

9. UI Prensipleri

Codex bu projeyi web sitesi gibi tasarlamamalıdır.

Ana UI ilkeleri
scene-first layout
dashboard görünümü yasak
SaaS / admin panel hissi yasak
büyük boşluklu landing page tarzı kompozisyon yasak
merkez sahne odaklı yapı
paneller sahneye eklenmiş gibi görünmeli
aşırı yuvarlak, modern web ui dili kullanılmamalı
glassmorphism kullanılmamalı
neon cyberpunk dili kullanılmamalı
Ekranlar
Lobby / Ready Screen
ana harita
oyuncu slotları
ready durumu
başlat butonu
Character Creation
avatar seçimi
sınıf seçimi
geçmiş seçimi
seçili karakter özeti
ready durumu
Main Scenario
ortada sahne
sağda durum paneli
altta kartlar
log / konuşma alanı
seçim alanı
Combat
üstte düşman alanı
ortada combat sahnesi
altta combat kartları
sağda parti bilgisi
combat logu
Kart ilkeleri
kartlar veri taşıyıcıdır
collectible card game süsü gibi görünmemeli
aynı temel layout ailesini paylaşmalı
minimum metin
güçlü görsel hiyerarşi
image slot mantığı korunmalı
10. Veri Modelleri

Minimum olarak aşağıdaki yapıların oluşturulması beklenir:

CardDefinition
CardInstance
CharacterDefinition
CharacterSelection
GameParticipant
GameSessionState
ScenarioState
SceneState
CombatState
GameAction
CombatAction
AssetManifest
ContentManifest
UISnapshot
Snapshot katmanları

En az şu katmanlar düşünülmelidir:

internal full state
public ui snapshot
participant-scoped snapshot (altyapı hazır olabilir)

İlk sürümde tam ayrıştırma şart olmayabilir ama veri modeli buna izin vermelidir.

11. İçerik Yükleme ve Registry

Motor:

klasörleri tarar
manifest/json dosyalarını okur
asset registry oluşturur
geçersiz içerikleri loglar
eksik asset durumunda placeholder kullanır
crash olmaz
Zorunlu özellikler
duplicate id tespiti
invalid json toleransı
missing file toleransı
predictable registry state
12. İlk Sürüm İçerik Mantığı

İlk sürümde senaryo sistemi minimum seviyede tutulacaktır.

Motor:

hazır içeriklerle çalışır
sahne paketlerini işler
seçimleri toplar
state değişikliklerini uygular

Bu sürümde amaç story generation değil, çalışan oyun iskeletidir.

13. Sprint Planı İçin Beklenen İş Bölümü

Codex önce plan oluşturmalı, sonra uygulamalıdır.

Sprint 1 — Mevcut Yapı Analizi
güncel game-room yapısını tara
mevcut oyun feature mimarisini çıkar
++cmd komut akışını tespit et
uygun entegrasyon noktalarını belirle
Sprint 2 — Yeni Oyun Modül İskeleti
yeni oyun feature ekle
host bağlantı noktalarını hazırla
engine/state/bridge dosyalarını oluştur
Sprint 3 — Veri Modelleri + Asset Registry
state modelleri
card/character models
asset/content loader
registry mantığı
manifest okuma
Sprint 4 — Lobby + Character Creation UI
game select / game entry
lobby / ready screen
character creation
seçim state’i
Sprint 5 — Main Scenario UI
sahne render
kart alanı
log / konuşma alanı
choice sistemi
side panel
Sprint 6 — Combat Engine + Combat UI
combat config loader
combat state
combat cards
combat screen
result log
Sprint 7 — Command Bridge + Sync
++cmd parser ve köprü
slot bazlı doğrulama
stale / duplicate toleransı
update akışı
Sprint 8 — Test + Cleanup + Regression
XOX / Team Tetris regressions
yeni oyun smoke tests
invalid payload tests
asset loading tests
serialization tests
14. Subagent Review Beklentisi

Plan öncesi ve uygulama sonrası review yapılmalı.

Plan öncesi review

Subagentlar şunları kontrol etmeli:

kapsam fazla geniş mi
v1 sınırı korunuyor mu
mevcut mimariye ters bir refactor var mı
gereksiz karmaşıklık var mı
Uygulama sonrası review

Subagentlar şunları kontrol etmeli:

plan ile uygulama uyumlu mu
yeni oyun mevcut oyunları bozmuş mu
asset sistemi doğru çalışıyor mu
UI sahne-odaklı mı, yoksa web app’e mi kaymış
invalid durumlarda oyun çöküyor mu

Review–düzeltme döngüsü, plan ve uygulama tam uyumlu olana kadar devam etmelidir.

15. Test Beklentileri
Otomatik testler

En az şu seviyede test beklenir:

engine init
state hydrate / serialize
asset registry load
invalid manifest tolerance
command parsing
basic scenario flow
basic combat flow
regression smoke test for existing games
Manuel checklist
game-room içinde yeni oyun seçilebiliyor mu
lobby ekranı doğru açılıyor mu
karakter seçimi çalışıyor mu
ready akışı çalışıyor mu
sahne ekranı geliyor mu
kartlar görünüyor mu
seçim gönderilebiliyor mu
combat ekranı açılıyor mu
combat sonucu state’e yazılıyor mu
XOX bozulmadı mı
Team Tetris bozulmadı mı
16. Kod Kalitesi ve Sınırlar
mevcut repo kod stiline uy
mevcut klasör mantığını bozma
büyük ve gereksiz refactor yapma
yeni sistemi bağımsız modül olarak kur
host tarafını gereksiz şişirme
mümkünse ortak arayüz çıkar ama mevcut oyunları bozma
UI’yi web sitesi gibi yorumlama
assetleri hardcode etme
gelecekte genişletilebilir ama şu an sade kalan çözüm tercih et
17. Teslim Beklentisi

Uygulama sonunda Codex şunları açıkça dökmeli:

eklenen dosyalar
değiştirilen dosyalar
yeni komut listesi
asset registry mantığı
content/manifest beklentisi
bilinen sınırlamalar
sonraki aşamada genişletilebilecek noktalar
18. Son Not

Bu görevde amaç, hayali tam sistemin tamamını şimdi kurmak değildir.

Amaç:

çalışır
sade
test edilebilir
mevcut game-room mimarisiyle uyumlu
asset ve içerik eklemeye açık
v2 fikirlerini taşıyabilecek kadar temiz

bir iskelet oluşturmaktır.

V1’de sadelik, doğru karardır.
Öncelik: çalışan sistem.
Sonraki aşamalar: zenginleştirme.


🧠 1. “İlk 5 dakika deneyimi” (en kritik)

Şu an sistem çok güçlü ama:

👉 oyuncu ilk açtığında ne yapacağını bilmiyorsa → her şey çöker

Game UI’nin amacı oyuncuyu yönlendirmektir; iyi UI oyuncuya hedefleri sezdirir

Add a minimal onboarding flow.

First-time user should:
- see only essential UI elements
- understand what to click without explanation
- be guided through first choice naturally

Avoid showing full system at once.
Progressively reveal UI.
🧠 2. “State görünürlüğü” (oyunun kalbi)

Şu soruların cevabı her an görünür olmalı:

sıra kimde?
combat mı değil mi?
seçim bekleniyor mu?
herkes ready mi?

Game UI aslında sistemleri “görünür hale getirme katmanı”dır

Every screen must clearly show current game state:

- current phase (lobby / creation / scenario / combat)
- active player / turn owner
- pending actions
- resolved actions

Never require the user to guess the state.
🧠 3. “Hata toleransı” (sessiz kırılma)

Bu sistem multi-AI + multi-user

👉 en tehlikeli şey: sessiz hata

kritik edge-case’ler
bir oyuncu cevap vermez
AI response gecikir
2 oyuncu farklı seçim yapar
duplicate command gelir
state sync kaçırılır

System must handle incomplete or delayed input gracefully.

Rules:
- do not block forever waiting for a player
- show waiting state clearly
- allow re-sync
- allow re-send
- tolerate duplicate actions
🧠 4. (bonus ama çok değerli)
“UI görünmezliği”

En iyi UI fark edilmez.

Eğer kullanıcı:

👉 UI’yi düşünüyorsa → bir şey yanlış

Game UI’nin amacı dikkat çekmek değil, akışı görünmez kılmaktır


UI should not draw attention to itself.

If a UI element becomes visually dominant,
it must be because of a gameplay reason (choice, danger, turn).

Otherwise, UI should remain quiet.
🧠 5. Senin projene özel en kritik nokta

Bu projeyi diğerlerinden ayıran şey:

👉 AI + insan + sistem birlikte oynuyor

Bu yüzden:

👉 “kimin konuştuğu”
👉 “kimin karar verdiği”

çok net olmalı


Always distinguish clearly:

- human player
- AI players
- system messages

Use consistent visual markers for each.
