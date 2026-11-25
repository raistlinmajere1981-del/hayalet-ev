# 03-A/2 Gaia Diagnostic — Ölçüm Raporu

**Tarih:** 2026-11-26

**Hedef cihaz:** SM-J701F (Android 9, API 28, armeabi-v7a)

**Taban commit:** 2dd0bdf2

**APK:** `gaia-diagnostic/app/build/outputs/apk/debug/app-debug.apk` (12 MB)

**Derleme komutu:** `cd gaia-diagnostic && ./gradlew assembleDebug --no-daemon`

---

## 1. Donanım Keşfi

### Cihaz kimlikleri

| Özellik         | Değer               |
| --------------- | ------------------- |
| Model           | SM-J701F            |
| Android         | 9 (API 28)          |
| ABI             | armeabi-v7a (ARM32) |
| Güvenlik yaması | 2021-06-01          |

### Sensörler (`dumpsys sensorservice`)

| Sensör                    | Üretici                    | Tip                    | Min–Max Hz | WakeUp   |
| ------------------------- | -------------------------- | ---------------------- | ---------- | -------- |
| K2HH Accelerometer        | STM                        | TYPE_ACCELEROMETER (1) | 5–100      | Hayır    |
| CM36672P Proximity        | Capella Microsystems, Inc. | TYPE_PROXIMITY (8)     | on-change  | **Evet** |
| Screen Orientation Sensor | Samsung Electronics        | Özel (27)              | on-change  | Hayır    |
| Motion Sensor             | Samsung Electronics        | Özel (65559)           | on-change  | Hayır    |

> **Mevcut değil:** Jiroskop, manyetometre, barometre, ortam ışığı sensörü, adımsayar.

> Toplam 2 donanım sensörü; 2 sanal (Samsung özgün).

### Batarya

| Metrik          | Değer (gözlem süresi)                               |
| --------------- | --------------------------------------------------- |
| Şarj seviyesi   | 82–85% (USB şarjda, test süresi boyunca yükseliyor) |
| Paket sıcaklığı | 19,8–20,0 °C                                        |
| Gerilim         | 4223–4313 mV                                        |
| Şarj durumu     | charging / usb                                      |

> **Not:** Batarya paketi sıcaklığı (≈20 °C), ortam sıcaklığından farklıdır. USB bağlantısı ve scrcpy/şarj bu değeri etkileyebilir.

### Kamera / Mikrofon

ADB `pm list features` ile teyit edilebilir. `PackageManager.FEATURE_CAMERA_ANY` ve `FEATURE_MICROPHONE` varlığı logcat'ta raporlandı; aktif kayıt yapılmadı (kapsam dışı).

### Ağ

Test süresi boyunca Wi-Fi ve hücresel ağ kapalıydı (SIM'siz, AP yok). `internet: false`, `wifi: false`, `rssi: null`.

---

## 2. İvmeölçer Ölçümleri

Cihaz yatay yüzeyde, hareketsiz:

| Eksen | Ortalama (m/s²) | Varyasyon |
| ----- | --------------- | --------- |
| X     | ≈ −0,09         | ±0,02     |
| Y     | ≈ −0,47         | ±0,02     |
| Z     | ≈ 9,68          | ±0,04     |

Z ≈ 9,68 m/s² → yerçekimi ivmesi doğrulandı.

SENSOR_DELAY_NORMAL ≈ 5 Hz (200 ms samplingPeriod).

### Yakınlık Sensörü

Sabit: **8,0 cm** (nesne yokken maksimum değer — bu modelde yalnız uzak uç değeri gözlendi; sürekli mesafe ölçebilme yeteneği doğrulanmadı).

---

## 3. Yaşam Döngüsü Testleri

| Senaryo                        | Sonuç                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Activity aracılığıyla başlatma | ✅ Çalışıyor — `isForeground=true`, `foregroundId=9701`                                                                                |
| Arka plana alma (HOME tuşu)    | ✅ Servis devam etti, 10s aralıklı tick'ler kesilmedi                                                                                  |
| Ekran kapatma (POWER tuşu)     | ✅ ADB üzerinden servis hâlâ `isForeground=true`, logcat verileri geldi                                                                |
| Activity bağımsızlığı          | ✅ Servis, Activity olmadan çalışmaya devam etti                                                                                       |
| Durdurma (force-stop)          | ⚠️ Süreç sonlandırma sonrası yeniden başlatma raporlandı; kullanılan sonlandırma yöntemi ve kullanıcı Stop davranışı ayrı doğrulanmadı |
| Sensör unregister              | ✅ `Previous Registrations` kaydına göre sensorObs `release()` çalıştı                                                                 |

> **Wake lock:** Alınmadı. DOZE mode cihazın kendi politikasına bırakıldı.

---

## 4. Bağlantı Deneyi (ADB Reverse + Test Alıcısı)

### Kurulum

Önce adb devices -l ile yalnız SM-J701F seri numarasını doğrula ve J701F_SERIAL değişkenine ata. Kişisel J700F hedeflenmemeli.

```bash
adb -s "$J701F_SERIAL" reverse tcp:7701 tcp:7701
python3 gaia-diagnostic/test_receiver.py --port 7701
```

### Sonuçlar

5 gözlem alındı, her biri ~10 saniye aralıklarla:

| Sunucu varış zamanı (UTC) | Bat% | Bat sıcaklığı | Accel X/Y/Z             | Prox   |
| ------------------------- | ---- | ------------- | ----------------------- | ------ |
| 2026-11-25T23:05:10       | 83%  | 19,9°C        | −0,092 / −0,469 / 9,697 | 8,0 cm |
| 2026-11-25T23:05:20       | 83%  | 19,8°C        | −0,090 / −0,462 / 9,691 | 8,0 cm |
| 2026-11-25T23:05:31       | 83%  | 19,8°C        | −0,093 / −0,462 / 9,697 | 8,0 cm |
| 2026-11-25T23:05:41       | 83%  | 19,8°C        | −0,081 / −0,438 / 9,713 | 8,0 cm |
| 2026-11-25T23:05:51       | 83%  | 19,9°C        | −0,096 / −0,461 / 9,671 | 8,0 cm |

**RTT (bağlantı geri döndüğünde):** 8–13 ms (loopback).

### Saat Sapması

| Alan                | Değer                                          |
| ------------------- | ---------------------------------------------- |
| `deviceWallMs`      | ≈ 1.483.273.812.347 ms (2017 Ocak ~15:29 UTC)  |
| `serverArrivalMs`   | ≈ 1.795.647.910.913 ms (2026 Kasım 25)         |
| `clockDiffMs`       | ≈ **312.374.098.566 ms ≈ 3617 gün ≈ ~9,9 yıl** |
| `deviceMonotonicMs` | ≈ 1.814 s (boot'tan bu yana ~30 dakika)        |

> J701F sistem saati **~2017 Ocak** gösteriyor (neden doğrulanmadı). **Wall clock güvenilmez; monotonik zaman yalnız aynı boot/oturum içinde karşılaştırılabilir.** Üretimde sensör örnek zamanı, paket zamanı ve merkezi kabul zamanı ayrılacak; TLS güveni ve saat önkoşulları 03-A/3'te kararlaştırılacak.

### Bağlantı Kesme / Geri Gelme

ADB reverse `--remove` ile bağlantı kesilince servis `ECONNREFUSED` hatası aldı ve çalışmaya devam etti. Reverse yeniden kurulunca bir sonraki tick'te (`relay OK rtt=8ms`) otomatik gönderim başarıyla gerçekleşti. **El ile yeniden bağlantı mantığına gerek kalmadı** — her tick bağımsız TCP bağlantısı açıyor.

---

## 5. Kaynak Tüketimi

| Metrik               | Değer                                  |
| -------------------- | -------------------------------------- |
| APK boyutu           | 12 MB (debug; release daha küçük olur) |
| PSS (çalışırken)     | ≈ 33 MB                                |
| RSS (çalışırken)     | ≈ 78 MB                                |
| Thread sayısı        | 25                                     |
| Sensör kayıt sıklığı | 200 ms (5 Hz — SENSOR_DELAY_NORMAL)    |
| Poll aralığı         | 10 saniye (0,1 Hz)                     |

> **Uyarı:** USB şarjı ve scrcpy (mirror) bellek ve CPU ölçümlerini etkileyebilir. Kısa deneyde uzun süreli batarya ömrü veya kararlılık sonucu çıkarılamaz.

---

## 6. Kapsam Dışı / Karşılaşılan Sınırlar

| Durum                            | Açıklama                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADB'den doğrudan servis başlatma | `exported="false"` nedeniyle engellendi (beklenen, güvenlik sınırı)                                                                                        |
| Wi-Fi RSSI                       | Test süresi boyunca ağ yoktu; `WifiManager.connectionInfo` derecation'ı API 28'de hâlâ çalışıyor                                                           |
| Kamera / Mikrofon kaydı          | Kapsam dışı bırakıldı (talep doğrultusunda)                                                                                                                |
| Root işlemleri                   | Yok                                                                                                                                                        |
| Uzun süreli dayanıklılık         | Yok — kapsam dışı                                                                                                                                          |
| START_STICKY davranışı           | Süreç ölümü sonrası START_STICKY yeniden başlatma ile açık kullanıcı durdurması ayrı test edilmeli; gerçek am force-stop davranışı bu deneyle kanıtlanmadı |

---

## 7. Üretim Client'ında Yeniden Kullanılabilir Bileşenler

| Bileşen                | Durum                   | Not                                                                                              |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `HardwareCollector.kt` | 🔧 Uyarlanabilir        | Batarya, ağ, sensör, zaman damgası toplama                                                       |
| `SensorObserver.kt`    | 🔧 Uyarlanabilir        | CONFLATED channel tabanlı düşük frekanslı sensör aboneliği                                       |
| `DiagnosticService.kt` | 🔧 Temel alınabilir     | Foreground service prototipi; açık durdurma, izin, iptal ve örnek tazeliği üretimde doğrulanmalı |
| `TestConnector.kt`     | ❌ Deney aracı          | ADB reverse loopback; üretim transportu 03-A/3'te seçilecek                                      |
| `test_receiver.py`     | ❌ Deney aracı          | Geçici; üretimde UI-bağımsız yetkili merkezi alıcı; Router zorunlu değil                         |
| Gradle altyapısı       | ✅ Aynen kullanılabilir | AGP 9.2.1, Gradle 9.5.1, minSdk 28                                                               |

---

## 8. Sonraki Adımlar (Nexa için açık test adımları)

```bash
# 1. Sensörü arka planda izlemek için logcat izleme (10 dakika)
adb -s "$J701F_SERIAL" logcat -s DiagnosticService:D > /tmp/diag_longrun.log &
# ... 10 dakika bekle
kill %1

# 2. Wi-Fi bağlanınca RSSI testi
# Cihaza Wi-Fi bağla, ardından APK'yı başlat:
adb -s "$J701F_SERIAL" shell am start -n com.hayaletev.gaiadiagnostic/.MainActivity --ez start_service true
adb -s "$J701F_SERIAL" logcat -d -s DiagnosticService:D | grep RSSI

# 3. Kamera varlığını doğrula
adb -s "$J701F_SERIAL" shell pm list features | grep camera

# 4. İzinleri kontrol et
adb -s "$J701F_SERIAL" shell dumpsys package com.hayaletev.gaiadiagnostic | grep -E "granted|CAMERA|RECORD"
```

## 9. Bağımsız kaynak kabulü — Nexa

Beş ham gözlem yerelde okundu; raporlanan batarya, ivme ve yakınlık değerleriyle uyumlu. APK dosyası 12.461.499 bayt; Gradle wrapper JAR özeti mevcut Companion wrapper'ıyla eşleşiyor. J701F'de teşhis APK'sı kurulu, kabul anında servis yok, 7701 reverse eşlemesi ve yerel dinleyici yok. Çevrimdışı assembleDebug tekrar koşumu geçti (37 görev up-to-date; temiz derleme değil). Gerçek cihaz HOME/POWER deneyleri, RTT ve PSS/RSS sonuçları uygulama agent'ının ölçümüne dayanıyor; yeniden koşulmadı. CPU ölçümü ve şarjdan bağımsız uzun süreli uyku/Doze çalışması doğrulanmadı.

Kaynak sınırlamaları: sensör olay timestampNs alanları gönderilen JSON'da yok; eski ivme örneği yeni örnek gibi kullanılmamalı, on-change yakınlık sensörü ayrı semantik gerektirir. registerListener dönüşü/ölçüm geçerliliği, batarya -1 sentinel'i, INTERNET capability ile gerçek erişim ayrımı, kamera/mikrofon izinlerinin gereksiz talep edilmesi, exported Activity'nin test amaçlı start/stop extras'ı, açık Stop/START_STICKY ve bind yaşam döngüsü, socket istisnalarında kapanış ve timeout/EOF/hatalı ACK'in başarı sayılması üretime taşınmayacak. Test alıcısı loopback deney aracıdır, güvenli saha protokolü değildir.

Karar: rootsuz temel telemetri fizibilitesi kabul; APK üretim Client'ı değildir. Uzun çalışma, sensör tazeliği, manuel durdurma ve bağlantı güvenliği üretim aşamalarında ayrı kabul kapısıdır. Ham gözlem, APK, build cache ve local.properties Git dışında tutulur; yerel dosyalar silinmez.
