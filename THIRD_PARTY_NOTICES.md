# Third-Party Notices

Hayalet Ev'in kendi kaynak kodu kökteki `LICENSE` dosyasındaki MIT License altında sunulur. Bu dosya, kaynak ağacına kasıtlı olarak gömülen veya vendored olarak tutulan bilinen üçüncü taraf materyalleri özetler.

`package.json`, `package-lock.json`, Android/Gradle yapılandırması ve diğer bağımlılık manifestleri üzerinden indirilen paketler kendi upstream lisanslarına tabidir; bu dosya transitive dependency lisanslarının yerine geçmez.

Gömülü materyaller için doğrulanmış upstream lisans kopyaları `third-party-licenses/` altında tutulur ve masaüstü dağıtımlarına dahil edilir.

## Lucide Icons

Kullanım:

- `src/assets/nav-icons/`
- `rooms/*` içindeki starter/navigation icon varlıkları

Kaynak: Lucide Icons projesi.

Lisans: upstream Lucide `LICENSE` dosyası ISC License içerir; Feather Icons'tan türeyen belirli ikonlar için ayrıca MIT bildirimini taşır.

Yerel kaynak notları:

- `src/assets/nav-icons/README.md`
- `rooms/ICON-SOURCES.md`

Upstream lisans kopyası:

- `third-party-licenses/LUCIDE.txt`

## Konva 10.3.0

Vendored kopyalar:

- `rooms/game-room/shared/vendor/konva.min.js`
- `rooms/repair-room/shared/vendor/konva.min.js`

Kaynak: Konva JavaScript Framework.

Lisans: MIT.

Vendored dosyanın kendi header'ı Konva sürümünü ve MIT lisansını belirtir. `package.json` içinde kullanılan `konva` paketi de aynı upstream projenin bağımlılığıdır.

Upstream lisans kopyası:

- `third-party-licenses/KONVA.txt`

## openWakeWord ONNX modelleri

Dosyalar:

- `android-companion/app/src/main/assets/melspectrogram.onnx`
- `android-companion/app/src/main/assets/embedding_model.onnx`
- `android-companion/app/src/main/assets/hey_jarvis_v0.1.onnx`

Kaynak ve ayrıntılar: `android-companion/app/src/main/assets/OPENWAKEWORD-MODELS.md`.

Lisans: Apache License 2.0.

Lisans metni:

- `third-party-licenses/APACHE-2.0.txt`

## Vosk Turkish small model

Dosya:

- `android-companion/app/src/main/assets/transcript-models/vosk-model-small-tr-0.3.zip`

Kaynak: Alpha Cephei Vosk model kataloğundaki `vosk-model-small-tr-0.3`.

Lisans: Apache License 2.0.

Yerel kaynak notu: `android-companion/app/src/main/assets/VOSK-MODEL.md`.

Lisans metni:

- `third-party-licenses/APACHE-2.0.txt`

## Tencent ncnn Piper / SimpleG2P kaynakları

Dosyalar:

- `scripts/android-ncnn-piper-native/piper.cpp`
- `scripts/android-ncnn-piper-native/piper.h`
- `scripts/android-ncnn-piper-native/simpleg2p.cpp`
- `scripts/android-ncnn-piper-native/simpleg2p.h`

Kaynak: Tencent ncnn projesindeki ilgili Android/Piper örnek kaynakları ve bu proje için yapılan uyarlamalar.

Lisans: BSD 3-Clause. İlgili dosyaların başındaki upstream copyright ve lisans header'ları korunmuştur.

Upstream ncnn lisans kopyası:

- `third-party-licenses/NCNN.txt`

## Gaia 02-A/1 yerel OpenPlan3D editörü

- [OpenPlan3D kaynak kodu](https://github.com/laanlabs/openPlan3D/tree/771c9e1ad30bd1c3cc7584d6eca74deb2e14943d), sürüm 0.9.0, MIT, © 2026 theLodgeStudio. Sabit commit'ten derlenen 2D tuval, düzenleme store'u ve bağlam menüsü kullanılır. [Lisans kopyası](rooms/gaia-room/scripts/editor/OPENPLAN3D-LICENSE) · [Patch](rooms/gaia-room/scripts/editor/openplan3d.patch)
- Yerel paketin JavaScript çıktısında Svelte 5.57.0 ve esm-env 1.2.2 (MIT) bulunur. Tailwind CSS 4.1.18 (MIT) derlenmiş CSS üretir. Derleme `OPENPLAN3D-LICENSE`, `DEPENDENCY-LICENSES.md` ve `TAILWIND-LICENSE` dosyalarını çıktıya ekler.
- OpenPlan3D’nin 2B çizimleri, inline ikonları ve izinli masa girdisi kullanılır. Gaia derlemesi mobilya listesini masayla sınırlar, entourage ve oda şablonu kataloglarını boşaltır ve upstream arayüz metnini tuval kapsamıyla sınırlar. Paket harici 3B model, doku, font veya görsel kataloğu içermez. [Üretim girdi filtresi](rooms/gaia-room/scripts/editor/openplan-distribution.mjs)
- Vite 7.3.7, Svelte Vite eklentisi 6.2.4, Tailwind Vite eklentisi 4.1.18, TypeScript 5.9.3, Svelte Check 4.3.6 ve Playwright 1.63.0 yerel derleme veya test araçlarıdır. Dağıtılan Tailwind CSS ve Svelte çalışma zamanı bildirimleri oda çıktısındadır. [Oda kilit dosyası](rooms/gaia-room/scripts/editor/package-lock.json) · [Oda bağımlılık lisansları](rooms/gaia-room/ui/DEPENDENCY-LICENSES.md)

## Yeni üçüncü taraf materyal eklerken

Kaynak ağacına yeni bir model, ikon, font, ses, görsel, vendored kütüphane veya başka bir üçüncü taraf materyal eklenirse kaynak ve yeniden dağıtım lisansı doğrulanmalı; gerekli attribution/lisans metinleri korunmalı, uygun upstream lisans kopyası eklenmeli ve bu dosya güncellenmelidir.

## Gaia 02-A/3 Three.js görünümü

- Three.js 0.187.0 (MIT) ve aynı paketin OrbitControls bileşeni, yalnız 3B görünüm açıldığında yüklenen yerel parçadadır. Telif ve lisans, oda paketindeki `DEPENDENCY-LICENSES.md` içinde yer alır. [Three.js kaynak kodu ve lisansı](https://github.com/mrdoob/three.js/tree/r187)
- `@types/three` 0.187.0 (MIT), `@types/stats.js`, `@types/webxr`, `@tweenjs/tween.js`, `fflate` ve `meshoptimizer` (MIT) ile `@dimforge/rapier3d-compat` (Apache-2.0) geliştirme bağımlılıklarıdır. Bu tip ağacından uygulama kodu dağıtım paketine girmez.

## Gaia 03-B3/2 yerel sertifika altyapısı

PKI.js 3.4.0 ve ASN1js 3.0.10 (BSD-3-Clause) X.509 ve PKCS#10 işlemlerinde, ipaddr.js 1.9.1 (MIT) IP SAN kodlamasında kullanılır. Bunlar merkezin JavaScript çalışma zamanı bağımlılıklarıdır. Sabit sürümler, transitif girdiler ve dağıtımla korunacak lisanslar aşağıda kayıtlıdır. [Paket kilidi](package-lock.json) · [Lisans metinleri](third-party-licenses/GAIA-FIELD-PKI.txt)
