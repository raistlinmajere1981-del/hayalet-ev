# Auto-Triggers Sistemi (UPDATED v6.0)

> ROVO'nun otomatik mod aktivasyonu kuralları

## Mod Tanımları ve Status Bar Formatları (REVIZED)

Her cevabın başında aktif modu gösteren basit format kullanılır:

### 🔧 STANDARD Mode (Nadir Kullanım)
```
📍 Mode: STANDARD
```
- **Kullanım:** SADECE sohbet + tek satır düzeltme
- **Örnekler:** "Merhaba", "Teşekkürler", typo fix
- **Süre:** Saniyeler

### 🧠 ULTRATHINK Mode (VARSAYILAN)
```
📍 Mode: ULTRATHINK
```
- **Kullanım:** TÜM teknik işlemler (DEFAULT)
- **Örnekler:** Analiz, debug, refactor, feature, test, build
- **Süre:** Değişken (kalite öncelikli)

### 🔬 RESEARCH Mode (ULTRATHINK + Web Search)
```
📍 Mode: ULTRATHINK + RESEARCH
```
- **Kullanım:** Belirsiz/bilinmeyen konular
- **Örnekler:** Güncel API, hata kodları, bilinmeyen kütüphane
- **Süre:** 1-10 dakika (araştırma dahil)

---

## Mod Geçiş Kuralları (UPDATED)

Bir mod değiştiğinde basit format kullanılır:

```
📍 Mode: STANDARD → ULTRATHINK
```

**ESKİ FORMAT (KALDIRILDI):**
```
――― MOD DEĞİŞİKLİĞİ: STANDARD → RESEARCH ―――
```

---

## VARSAYILAN: ULTRATHINK (v6.0 - CRITICAL CHANGE)

**⚠️ TÜM teknik işlemler ULTRATHINK ile başlar:**

- ✅ Kod analizi ve hata tespiti
- ✅ Dosya okuma/yazma/düzenleme
- ✅ TypeScript hatalarını düzeltme
- ✅ Test çalıştırma ve debug
- ✅ Refactoring ve optimizasyon
- ✅ Architecture değerlendirme
- ✅ Git işlemleri
- ✅ Build/deploy süreçleri

## STANDARD Mod Tetikleyicileri (Nadir)

**Sadece şunlar:**
- Küçük sohbet ("Nasılsın?", "Teşekkürler")
- Tek satır typo düzeltme
- Tek import ekleme (zaten bilinen paket)

## RESEARCH Mod Tetikleyicileri (OTOMATIİK WEB SEARCH)

**ZORUNLU araştırma durumları:**

1. Hata mesajı içeren sorular
2. "Güncel/2024/2025/2026/en son" kelimeleri

3. Bilinmeyen kütüphane/API
4. Versiyon-spesifik sorular
5. Best practice soruları
6. Performans karşılaştırması

## ULTRATHINK Mod Tetikleyicileri

- Mimari kararlar
- State management seçimi
- Güvenlik konuları
- Performans optimizasyonu
- Breaking change değerlendirmesi

## Not Defteri Tetikleyicileri

Şu durumlarda `.rovo/notebook.md`'ye not ekle:

- Tool hata verdiğinde **(komut + hata çıktısı + kısa teşhis + olası çözüm)**
- Web search alakasız sonuç döndüğünde
- Yeni tool fikri oluştuğunda
- Tekrarlayan pattern fark edildiğinde
---
v1.0 - 2026-01-24
