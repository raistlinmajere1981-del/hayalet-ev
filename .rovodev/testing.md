# Hayalet-ev Test Rehberi

Bu rehber, AI agent'ların Hayalet-ev projesinde test süreçlerini yürütmesi için gerekli workflow'ları ve best practice'leri içerir.

## 🎯 AI Agent Test Workflow'u

### Standart Test Döngüsü

```
1. Kod değişikliği yap
2. Lint kontrolü (npm run lint)
3. Uygulamayı başlat (npm start)
4. CDP ile bağlantı kontrolü
5. Fonksiyonel test (CDP tool'ları ile)
6. Log analizi
7. Hata varsa düzelt, döngüyü tekrarla
8. Commit & push
```

---

## 🔧 Temel Test Komutları

### 1. Lint Kontrolü

```bash
# Tüm kodu kontrol et
npm run lint

# Otomatik düzeltme
npm run lint:fix

# Sadece hatalar (uyarıları atla)
npm run lint 2>&1 | grep -i "error"
```

**Beklenen:** Sadece uyarılar kabul edilebilir, hata olmamalı.

### 2. Uygulamayı Başlatma

```bash
# Development mode
npm start

# Background'da başlat (AI agent için)
npm start &

# PID'i kaydet
echo $! > /tmp/hayalet-ev.pid
```

### 3. Uygulamayı Durdurma

```bash
# Electron'u kapat
pkill -f "electron . --no-sandbox"
pkill -f "vite"

# veya PID ile
kill $(cat /tmp/hayalet-ev.pid)
```

---

## 🎯 CDP ile Fonksiyonel Test

### Bağlantı Kontrolü

```bash
# Port açık mı?
curl -s http://localhost:9222/json | head -5

# MCP tool ile
check_electron_connection
```

### UI Element Testleri

```bash
# Element var mı?
inspect_element --selector "#menu-toggle"

# Tüm butonları listele
query_elements --selector "button"

# DOM yapısını incele
get_page_dom_structure --maxDepth 2
```

### Etkileşim Testleri

```bash
# Butona tıkla
click_element_by_selector --selector "#webview-btn"

# Metin ile tıkla
click_element_by_text --text "Bağlan" --tagName "button"

# Input doldur
fill_input_field --selector "#email" --value "test@test.com"

# Enter tuşu
send_key_press --key "Enter"
```

### Görsel Doğrulama

```bash
# Screenshot al
take_cdp_screenshot --savePath "./test-screenshot.png"

# Öncesi/sonrası karşılaştırma
take_cdp_screenshot --savePath "./before.png"
click_element_by_selector --selector "#toggle"
take_cdp_screenshot --savePath "./after.png"
```

---

## 📂 Log Analizi

### Test Sonrası Log Kontrolü

```bash
# En son session'ı bul
LATEST_LOG=$(ls logs/ | sort -r | head -1)

# 1. Önce hataları kontrol et
cat "logs/$LATEST_LOG/error.log" 2>/dev/null || echo "Hata yok ✅"

# 2. Ana logları incele
tail -100 "logs/$LATEST_LOG/console-001.log"

# 3. Belirli pattern ara
grep -i "error\|fail\|exception" "logs/$LATEST_LOG/console-001.log"

# 4. Session özetini kontrol et
cat "logs/$LATEST_LOG/summary.json"
```

### Başarı Kriterleri

| Kontrol | Beklenen | Komut |
|---------|----------|-------|
| error.log | Boş veya yok | `cat logs/$LATEST_LOG/error.log` |
| summary.json | `endReason: "normal"` | `cat logs/$LATEST_LOG/summary.json` |
| console.log | Kritik hata yok | `grep -i "error" logs/$LATEST_LOG/console-001.log` |

---

## 🧪 Senaryo Bazlı Testler

### Senaryo 1: Entrance Sayfası

```bash
# 1. Uygulamayı başlat
npm start &
sleep 5

# 2. Bağlantı kontrolü
check_electron_connection

# 3. Sayfa kontrolü
get_electron_window_info
# URL: file:///.../entrance.html olmalı

# 4. Elementleri kontrol et
query_elements --selector ".account-card"
inspect_element --selector "#user-panel"

# 5. Screenshot
take_cdp_screenshot --savePath "./entrance-test.png"
```

### Senaryo 2: Webview Sayfası

```bash
# 1. Webview sayfasına git
click_element_by_selector --selector "#webview-btn"
sleep 2

# 2. Webview'ların varlığını kontrol et
send_command_to_electron --command "document.querySelectorAll('webview').length"

# 3. Slot durumunu kontrol et
inspect_element --selector "#ai1-slot"
inspect_element --selector "#ai2-slot"
```

### Senaryo 3: Database İşlemleri

```bash
# 1. Database klasörlerini kontrol et
ls -la data/

# 2. Uygulamada sync tetikle
# (Manuel veya otomatik)

# 3. Logları kontrol et
grep "database\|sync" "logs/$LATEST_LOG/console-001.log"
```

---

## 🚨 Yaygın Test Hataları

### "Electron'a bağlanılamadı"

```bash
# Electron çalışıyor mu?
pgrep -f electron

# Port açık mı?
netstat -tlnp | grep 9222

# Çözüm: Yeniden başlat
pkill -f electron
npm start &
sleep 5
```

### "Element bulunamadı"

```bash
# DOM yapısını incele
get_page_dom_structure --maxDepth 4

# Alternatif selector dene
query_elements --selector "*"

# Sayfa tam yüklendi mi?
send_command_to_electron --command "document.readyState"
```

### "Lint hataları"

```bash
# Detaylı hata listesi
npm run lint 2>&1 | grep -A2 "error"

# Otomatik düzelt
npm run lint:fix

# Düzelmeyen hataları manuel düzelt
```

---

## 📋 Test Checklist

### Kod Değişikliği Sonrası

- [ ] `npm run lint` hatasız geçti
- [ ] Uygulama başarıyla başladı
- [ ] CDP bağlantısı aktif
- [ ] Değişiklik yapılan sayfa/özellik çalışıyor
- [ ] Log dosyasında kritik hata yok
- [ ] Session normal şekilde kapandı

### Commit Öncesi

- [ ] Tüm testler geçti
- [ ] Geçici test dosyaları silindi (`tmp_rovodev_*`)
- [ ] Console.log yerine LogManager kullanıldı
- [ ] AGENTS.md/README güncel (gerekirse)

---

## 🔄 Otomatik Test Script'i

Hızlı test için kullanılabilecek script:

```bash
#!/bin/bash
# tmp_rovodev_test.sh

echo "=== Lint Kontrolü ==="
npm run lint 2>&1 | tail -10

echo -e "\n=== Electron Başlatılıyor ==="
npm start &
sleep 8

echo -e "\n=== CDP Bağlantı Kontrolü ==="
curl -s http://localhost:9222/json | head -3

echo -e "\n=== Screenshot ==="
# MCP tool veya curl ile

echo -e "\n=== Electron Kapatılıyor ==="
pkill -f "electron . --no-sandbox"

echo -e "\n=== Log Kontrolü ==="
LATEST_LOG=$(ls logs/ | sort -r | head -1)
echo "Session: $LATEST_LOG"
cat "logs/$LATEST_LOG/error.log" 2>/dev/null || echo "Hata yok ✅"

echo -e "\n=== Test Tamamlandı ==="
```

---

---

## 🛠️ Yardımcı Script'ler

### npm Script'leri

```bash
# === Test ===
npm run test:smoke              # Smoke test (Electron çalışıyor olmalı)
npm run test:smoke:auto         # + otomatik Electron başlatma
npm run test:smoke:verbose      # + detaylı + screenshot

# === Kod Kalitesi ===
npm run pre-commit              # Lint + console.log yasağı
npm run lint:unused             # Kullanılmayan export'ları bul

# === Proje Analizi ===
npm run analyze                 # Tam proje analizi
npm run analyze -- --summary    # Sadece özet istatistikler
npm run analyze:json            # JSON formatında çıktı

# === Diagram Oluşturma ===
npm run diagram                 # Modül bağımlılık diagramı (Mermaid)
npm run diagram:simple          # Basitleştirilmiş diagram
npm run diagram -- --module=webview  # Tek modül odaklı
npm run diagram -- --format=dot      # Graphviz DOT formatı

# === Dosya İşlemleri ===
npm run file -- delete file1.js file2.js   # Çoklu dosya silme
npm run file -- delete-dir folder --force  # Klasör silme
npm run file -- move src.js dest/          # Taşıma
npm run file -- copy src.js dest.js        # Kopyalama
npm run file -- list dir -r                # Listeleme (recursive)
npm run file -- find "*.md" docs/          # Dosya arama
npm run file -- clean-empty .              # Boş klasörleri temizle

# === Yardımcı ===
npm run edit-lines -- AGENTS.md --show 100 120  # Satır bazlı düzenleme
npm run bootstrap                               # Session context oluştur
npm run cache:update                            # Cache güncelle
```

### Satır Bazlı Dosya Düzenleme

AI agent'ların büyük dosyalarda `find_and_replace` hatası aldığında kullanması için:

```bash
# Satır aralığını göster
node .rovodev/scripts/edit-lines.js AGENTS.md --show 100 150

# Satır aralığını değiştir
echo "yeni içerik" > /tmp/new.txt
node .rovodev/scripts/edit-lines.js AGENTS.md 100 150 /tmp/new.txt

# Satır aralığını sil
node .rovodev/scripts/edit-lines.js AGENTS.md --delete 100 150

# Satırdan sonra ekle
node .rovodev/scripts/edit-lines.js AGENTS.md --insert 100 /tmp/insert.txt

# Yedekli düzenleme
node .rovodev/scripts/edit-lines.js AGENTS.md 100 150 /tmp/new.txt --backup
```

### Pre-commit Hook Kurulumu

```bash
# Manuel kurulum
cp .rovodev/scripts/pre-commit.js .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# veya her commit öncesi manuel çalıştır
npm run pre-commit
```

### Dosya İşlemleri (Tool Kısıtlamalarını Aşar)

AI agent'lar için `delete_file` gibi tool'lar sınırlı. Bu script toplu işlemleri destekler:

```bash
# Çoklu dosya silme
npm run file -- delete old1.js old2.js old3.js

# Klasör silme (boş)
npm run file -- delete-dir old-folder

# Klasör silme (dolu - dikkatli kullan!)
npm run file -- delete-dir old-folder --force

# Taşıma (move_file yerine)
npm run file -- move scripts/old.js .rovodev/scripts/

# Boş klasörleri toplu temizle
npm run file -- clean-empty .

# Dosya arama
npm run file -- find "*.test.js" src/
```

**Avantajları:**
- Çoklu dosya desteği (tek komutta N dosya)
- Klasör silme (tool ile yapılamaz)
- Boş klasör temizliği
- Glob pattern ile arama

---

## 🔗 İlgili Rehberler

- `.rovodev/logging.md` - Log sistemi ve kullanımı
- `.rovodev/cdp.md` - CDP tool'ları detaylı rehber
- `AGENTS.md` - Ana geliştirme rehberi
