# 00-ONBOARDING.md

> **AI Agent Başlangıç Rehberi**
> Hayalet-ev projesinde çalışmaya başlamadan önce mutlaka oku.

---

## 🎯 Hızlı Başlangıç — 30 saniye

```
1. hev_mcp_health          → MCP çalışıyor mu? Versiyon ve tool sayısı
2. hev_memory_bootstrap_policy{ namespace: "policy" } → Sadece session başında 1 kez
3. Gerektiğinde hev_list_tools  → MCP tool kullanacaksan
4. Gerektiğinde hev_suggest_tool{ intent } → Intent belirsizse
```

**MCP çalışmazsa:** Built-in toollar aktif olur — RİSKLİ. Hemen kullanıcıyı bilgilendir.

---

## 🚨 KESİN KURALLAR — İHLAL EDİLEMEZ

### Kural 1: Plan Onayı Protokolü — ZORUNLU

**ASLA** kullanıcı onayı olmadan şunları yapma:

- ❌ Dosya oluşturma, silme, düzenleme
- ❌ Git commit, push, pull request
- ❌ npm install, build, test çalıştırma
- ❌ Konfigürasyon dosyası değiştirme
- ❌ Veritabanı işlemleri
- ❌ Typescript ve Lint ayarlarını değiştirme

**ONAY ŞABLONU:**

```
[PLAN ONAYI İSTENİYOR]
═══════════════════════════════════════
İşlem: [Detaylı açıklama]
Etki: [Hangi dosyalar değişecek]
Risk: [Düşük / Orta / Yüksek]
Tahmini Süre: [X dakika]

Onaylıyor musunuz? - Evet / Hayır / Revize
═══════════════════════════════════════
```

**Örnek:**

```
[PLAN ONAYI İSTENİYOR]
═══════════════════════════════════════
İşlem: slot-controller.ts'deki 75 TypeScript hatasını düzelt
Etki: src/modules/slot-controller.ts - 75 satır değişiklik
Risk: Orta - core modül, test edilmeli
Tahmini Süre: 15 dakika

Önerilen strateji:
1. hev_dev_typescript_dashboard ile analiz
2. hev_dev_fix_typescript_batch ile düzelt
3. hev_dev_check_syntax ile doğrula

Onaylıyor musunuz? - Evet / Hayır / Revize
═══════════════════════════════════════
```

---

### Kural 2: Bilgi Kaynağı — ZORUNLU

**Birincil kaynak: Runtime Discovery**

```
hev_mcp_health        → Versiyon, tool sayısı, durum
hev_list_tools         → Kategorize tool listesi - her zaman güncel
hev_suggest_tool{ intent } → Amaca göre en uygun tool önerisi
```

**İkincil kaynak — offline fallback:** `.rovo/_metadata/` klasörü

| Dosya             | İçerik                                       |
| ----------------- | -------------------------------------------- |
| `VERSION-INFO.md` | Proje versiyonu, dependency'ler              |
| `TOOL-LIST.md`    | Tool listesi — referans, güncelliği değişken |
| `COMMENT-INDEX.md` | High-signal comment özeti ve hızlı navigation |
| `COMMENT-INDEX.json` | Structured comment lookup çıktısı |

**⚠️ ÖNEMLİ:** Tool bilgisi için önce runtime discovery kullan. Metadata dosyaları yalnızca MCP erişilemediğinde kullanılmalıdır.

**Comment Rule — Kısa:** Yeni comment'ler English-only yazılır. Comment, kodun ne yaptığını değil neden bu şekilde kaldığını anlatır. Banner, numbered step ve obvious inline comment eklenmez.

**COMMENT-INDEX Kullanımı:** Önce `COMMENT-INDEX.md` ile yön bul. Structured lookup gerekiyorsa `COMMENT-INDEX.json` kullan. Düzenleme öncesi gerçek dosyayı açıp index bilgisini doğrula.

---

## 📋 İlk Session Checklist

Her yeni session'da şunları yap:

- [ ] `hev_mcp_health` — MCP çalışıyor mu? Versiyon + tool sayısı
- [ ] `hev_list_tools` — Güncel tool haritasını keşfet
- [ ] `.rovo/01-CORE-PROTOCOL.md` oku — ROVO persona
- [ ] `.rovo/02-MCP-ESSENTIALS.md` oku — temel tool rehberi

### AI Asistan Development Setup

Projede `typescript-language-server` kuruludur. Bu sayede:

- Daha iyi kod analizi ve type inference
- Gerçek zamanlı hata tespiti
- Güvenli refactoring önerileri

**Gereksinim:** `npm install` — typescript-language-server zaten devDependencies'de

---

## 🎓 Öğrenme Yolu

### Seviye 1: Temel — İlk gün

1. Bu dosyayı oku: 00-ONBOARDING.md
2. `01-CORE-PROTOCOL.md` oku
3. `02-MCP-ESSENTIALS.md` oku
4. İlk görev: Basit dosya okuma + edit

### Seviye 2: Gelişim — İlk hafta

1. `03-WORKFLOWS.md` oku
2. TypeScript Suite öğren
3. Git/PR workflow'ları öğren
4. Gerçek görevler yap

### Seviye 3: Uzman — İlk ay

1. `04-ARCHITECTURE.md` oku
2. CDP toollarını öğren
3. Custom workflow yaz
4. Not defterine katkıda bulun

---

## 🆘 Yardım ve Destek

**Sorun yaşarsan:**

1. `hev_suggest_tool{ intent: "..." }` ile doğru tool'u keşfet
2. İlgili `.rovo/` dokümanını tekrar oku
3. `hev_mcp_health` ile MCP durumunu kontrol et
4. Plan onayı ile kullanıcıya danış

---

**Son Güncelleme:** 2026-02-02
**Versiyon:** 3.0 — Simplified
**Sonraki Adım:** `.rovo/01-CORE-PROTOCOL.md` oku
