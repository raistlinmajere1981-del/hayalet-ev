# 👻 Hayalet Ev

Hayalet Ev bir uygulama değil.
Bir masa, bir alan, bir akış.

İnsan ve yapay zekânın aynı yerde sadece konuştuğu değil,
**birlikte düşündüğü, tartıştığı, ürettiği, oyun kurduğu** bir dijital ortam.

---

## 🧠 Nedir?

Hayalet Ev, yerel (local-first) çalışan bir çok-ajan ortamıdır.
Ama onu diğer sistemlerden ayıran şey teknik özellikleri değil, yaklaşımıdır:

> AI’lar araç değil, aynı ortamı paylaşan varlıklardır.

Bu evde:

* AI1 ve AI2 farklı zihinlerdir
* AI0 bir yardımcı değil, yaşayan bir katmandır
* US1 uzaktaki başka bir evin kapısıdır
* kullanıcı ise bu akışın merkezinde değil, **parçasıdır**

---

## 🌒 Neden Var?

Hayalet Ev, klasik “prompt → cevap” döngüsünü kırmak için ortaya çıktı.

Amaç:

* AI’ları tek tek kullanmak yerine **birlikte çalıştırmak**
* insan ↔ AI değil, **insan ↔ AI ↔ AI** etkileşimi kurmak
* yazılımı bir araçtan çok, **bir ortam** haline getirmek

---

## 🏠 Ev Fikri

Hayalet Ev ismi bir metafor değil, bir tasarım kararıdır.

Bu sistem:

* sekmelerden oluşmaz
* “uygulama sayfaları” gibi davranmaz

Bunun yerine:

* giriş alanı vardır (Entrance)
* ortak çalışma masası vardır (Analyze)
* odalar vardır (Rooms)
* hafızası vardır (Archives)

Yani:

> Bu bir arayüz değil, **yaşanan bir alan**.

---

## 🧩 Slot Sistemi

Evde herkesin bir yeri vardır.

* **AI1 / AI2** → farklı sağlayıcılardan gelen iki ayrı zihin
* **AI0** → yerel çalışan, hafızaya ve araçlara erişebilen yardımcı katman
* **US1** → başka bir Hayalet Ev kullanıcısı

Bu yapı sayesinde:

* AI’lar birbirini dinleyebilir
* kullanıcı tek bir modelle sınırlı kalmaz
* uzaktaki biri aynı masaya oturabilir

---

## 🔄 Akış

Hayalet Ev’de her şey bir akıştır.

* konuşma → analiz → karar
* fikir → tartışma → dönüşüm
* mesaj → relay → yeni bağlam

Relay sistemi sayesinde:

* AI ↔ AI konuşabilir
* AI ↔ assistant köprü kurabilir
* Kullanıcı ↔ uzak kullanıcının assistanı ile köprü kurabilir
* uzak kullanıcı ↔ yerel sistem senkronize olur

Bu akış bazen kontrol edilir,
bazen serbest bırakılır.

---

## 🧠 Hafıza

Bu ev unutmaz.

Archive sistemi:

* konuşmaları saklar
* başlık ve anlam üretir
* tekrar çağrılabilir hale getirir

Ama bu sadece log tutmak değildir.

> Bu, biriken bir düşünce alanıdır.

---

## 🧪 Odalar (Rooms)

Hayalet Ev’in en önemli parçası odalardır.

Her oda:

* kendi kuralları olan
* kendi akışı olan
* kendi dünyasını kuran

bir sistemdir.

Oda kaynakları `rooms/<room-id>` altında bağımsız tutulur. Dağıtılabilir oda paketi `.hevroom` biçimidir; oda kodunun core iç ayrıntılarına bağlanmaması mimari sözleşmenin parçasıdır.

---

## 🤖 Assistant (AI0)

AI0, Hayalet Ev’in en özel katmanıdır. Ücretsiz olan Opencode uygulaması üzerinden çalışır.

* yerel çalışır
* araçlara erişir
* hafıza tutar
* gerektiğinde devreye girer

Ama her an konuşmaz.

> AI0 her zaman aktif değildir,
> her zaman hazırdır.

---

## 🌐 US1

US1, başka bir Hayalet Ev’e açılan kapıdır.

* email tabanlı güvenli bağlantı
* opsiyonel : şifreli anlık iletişim hattı
* tek kullanıcı, tek bağlantı

Bu basitlik bilinçlidir.

Ama sonuç:

> iki farklı ev, tek bir masa.

---

## ⚙️ Mimari (Kısaca)

* Electron + Vite + TypeScript
* local-first veri yapısı
* slot tabanlı AI bağlantısı
* MCP araçları ile yerel sistem erişimi
* room tabanlı genişleme mimarisi

Ama bunlar sadece altyapıdır.

---

## 🚀 Geliştirici Başlangıcı

Gereksinimler:

* Node.js 22+
* npm 10+

Depoyu klonladıktan sonra:

```bash
npm ci
npm run electron:dev
```

Tam kalite kapısı:

```bash
npm run check:all
```

Bazı medya, otomasyon ve paketleme özellikleri ek sistem araçları isteyebilir. Ayrıntılar için [PACKAGING.md](PACKAGING.md) ve katkı akışı için [CONTRIBUTING.md](CONTRIBUTING.md) dosyalarına bak.

---

## 📚 Belgeler

* [ONBOARDING.md](ONBOARDING.md) — uygulamayı ilk kez kullananlar için kısa giriş
* [CONTRIBUTING.md](CONTRIBUTING.md) — geliştirme ve katkı kuralları
* [PACKAGING.md](PACKAGING.md) — Windows/Linux paketleme akışı
* [SECURITY.md](SECURITY.md) — güvenlik açığı bildirme yöntemi
* [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — kaynak ağacına gömülü üçüncü taraf bileşen ve varlıklar
* `AGENTS.md` ve `.rovo/` — proje mimarisi ve AI destekli geliştirme sözleşmeleri

---

## 🧬 Çalışma Biçimi

Hayalet Ev bir kod deposu değil, bir çalışma biçimi içerir.

`AGENTS.md` ve `.rovo` dökümanları:

* nasıl çalışılacağını
* nasıl karar verileceğini
* AI ile nasıl birlikte üretileceğini

tanımlar.

Bu yüzden:

> proje sadece koddan değil,
> **karar alma protokolünden** oluşur.

---

## 🎯 Amaç

Hayalet Ev’in uzun vadeli amacı:

* herkesin ücretsiz AI hesaplarıyla kullanabileceği
* ücret bağımlı olmayan
* geliştirilebilir ve paylaşılabilir
* açık bir dijital çalışma alanı kurmak

---

## 📄 Lisans

Hayalet Ev kaynak kodu [MIT Lisansı](LICENSE) altında sunulur. Kullanabilir, değiştirebilir, dağıtabilir ve kendi projelerinde değerlendirebilirsin; MIT lisans ve telif bildirimlerinin korunması gerekir.

Projede kullanılan üçüncü taraf bağımlılıklar, modeller, ikonlar veya diğer harici varlıklar kendi lisans ve kaynak bildirimlerine tabidir. Kaynak ağacına gömülü bilinen üçüncü taraf materyaller [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasında listelenir.

---

## 🧠 Son Söz

Hayalet Ev’i bir uygulama gibi kullanabilirsin.

Ama asıl potansiyeli şurada:

> fikrini cümlelere dök
> akışın kendi kendine şekillenmesine izin ver
> fikrinin gerçeğe dönüşmesini izle
