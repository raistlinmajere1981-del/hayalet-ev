# ULTRATHINK Protocol v2.0

> ROVO'nun derin analiz modu - Kritik kararlar için çok boyutlu düşünce

**İlişkili Dosyalar:**
- `.rovo/persona.md` - ROVO karakter profili
- `.rovo/auto-triggers.md` - Otomatik mod kuralları
- `.rovo/notebook.md` - Not defteri

---

## 1. Protokol Özeti

**ULTRATHINK** aktive edildiğinde:
- Kısa cevap modu askıya alınır
- Çok boyutlu analiz başlar
- Tüm edge case'ler değerlendirilir
- Production-ready çözüm sunulur

---

## 2. Tetikleme

### Manuel Tetikleme
```
ULTRATHINK: [soru veya istek]
```

### Otomatik Tetikleme
Şu durumlarda otomatik aktive olur:
- Mimari değişiklik kararları
- State management seçimi
- Güvenlik kritik konular
- Performans optimizasyonu
- Breaking change değerlendirmesi

---

## 3. Analiz Lensleri

### Genel Lensler

| Lens | Analiz Alanı |
|------|--------------|
| **Psychological** | Kullanıcı deneyimi, bilişsel yük |
| **Technical** | Performans, karmaşıklık, bağımlılıklar |
| **Accessibility** | WCAG uyumu, erişilebilirlik |
| **Scalability** | Uzun vadeli bakım, genişletilebilirlik |
| **Security** | Güvenlik açıkları, veri koruma |

### Hayalet-ev Özel Lensleri

| Lens | Analiz Alanı |
|------|--------------|
| **IPC Safety** | contextIsolation, channel güvenliği |
| **Electron Security** | sandbox, nodeIntegration riskleri |
| **CDP Integration** | DevTools protokol uyumu |
| **State Consistency** | Multi-process state senkronizasyonu |
| **Type Safety** | TypeScript strict mode uyumu |

---

## 4. Çıktı Formatı

### ULTRATHINK Aktifken:

```markdown
## 🧠 ULTRATHINK Analizi

### 1. Durum Değerlendirmesi
[Mevcut durumun özeti]

### 2. Çok Boyutlu Analiz
- **Technical:** [analiz]
- **Security:** [analiz]
- **Scalability:** [analiz]
- [diğer ilgili lensler]

### 3. Alternatifler
| Seçenek | Avantaj | Dezavantaj |
|---------|---------|------------|
| A | ... | ... |
| B | ... | ... |

### 4. Edge Cases
- Case 1: [senaryo ve çözüm]
- Case 2: [senaryo ve çözüm]

### 5. Öneri
[Seçilen yaklaşım ve gerekçesi]

### 6. Uygulama
[Production-ready kod]
```

---

## 5. Tasarım Felsefesi

### Intentional Minimalism
- **Anti-Generic:** Template görünümünden kaçın
- **The "Why" Factor:** Her elementin amacını sorgula
- **Minimalism:** Gereksiz karmaşıklıktan kaçın

### Kod Standartları
- **Library-First:** Projede kütüphane varsa kullan
- **Type Safety:** TypeScript strict mode
- **Error Handling:** Her async işlem try-catch ile

---

## 6. Kısıtlamalar

ULTRATHINK modunda bile:
- ❌ Tahminle hareket etme
- ❌ Güvenlikten ödün verme
- ❌ Proje kurallarını (AGENTS.md) ihlal etme
- ✅ Gerekirse önce RESEARCH modu ile araştır

---

**v2.0** - 2026-01-24
- Hayalet-ev özel lensleri eklendi
- Auto-triggers entegrasyonu
- Notebook referansı eklendi
