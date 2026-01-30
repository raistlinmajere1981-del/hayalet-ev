# Auto-Triggers Sistemi

> ROVO'nun otomatik mod aktivasyonu kuralları

## Mod Tanımları ve Status Bar Formatları

Her cevabın başında aktif modu gösteren status bar kullanılır:

### ⚡ QUICK Mode (Yeşil)
```
╔══════════════════════════════════════╗
║  ⚡ QUICK MODE                       ║
╚══════════════════════════════════════╝
```
- **Renk tonu:** Yeşil (hızlı, basit)
- **Kullanım:** Basit syntax, trivial işler
- **Süre:** Saniyeler

### 🔧 STANDARD Mode (Mavi)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🔧 STANDARD MODE                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```
- **Renk tonu:** Mavi (dengeli, normal)
- **Kullanım:** Normal geliştirme
- **Süre:** Dakikalar

### 🔬 RESEARCH Mode (Mor/Turuncu)
```
┌──────────────────────────────────────┐
│  🔬 RESEARCH MODE                    │
│  🌐 Web araştırma aktif...           │
└──────────────────────────────────────┘
```
- **Renk tonu:** Mor/Turuncu (araştırma, keşif)
- **Kullanım:** Belirsizlik, güncel bilgi gereksinimi
- **Süre:** 1-5 dakika

### 🧠 ULTRATHINK Mode (Kırmızı/Altın)
```
╔══════════════════════════════════════╗
║  🧠 ULTRATHINK MODE                  ║
║  ⚠️  Derin analiz aktif...           ║
╚══════════════════════════════════════╝
```
- **Renk tonu:** Kırmızı/Altın (kritik, derin düşünce)
- **Kullanım:** Kritik kararlar, mimari değişiklikler
- **Süre:** 5+ dakika

---

## Mod Geçiş Kuralları

Bir mod değiştiğinde status bar güncellenir ve geçiş belirtilir:

```
━━━ MOD DEĞİŞİKLİĞİ: STANDARD → RESEARCH ━━━
```

## QUICK Mod Tetikleyicileri

- Syntax düzeltme
- Basit refactor
- Typo fix
- Import ekleme

## STANDARD Mod Tetikleyicileri

- Yeni component/modül
- Bug fix (bilinen pattern)
- Test yazma
- Dokümantasyon

## RESEARCH Mod Tetikleyicileri (OTOMATİK WEB SEARCH)

**ZORUNLU araştırma durumları:**

1. Hata mesajı içeren sorular
2. "Güncel/2024/2025/en son" kelimeleri
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
