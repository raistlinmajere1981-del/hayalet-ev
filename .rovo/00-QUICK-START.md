# 🚀 Quick Start Guide - 5 Dakikada Başla

> Hayalet-ev geliştirme ortamına hızlı başlangıç rehberi

---

## ✅ Health Check (30 saniye)

Önce MCP server'ın çalıştığından emin olalım:

```bash
# Terminal'de çalıştır:
hev_mcp_health()
```

**Beklenen çıktı:**

```
✅ Hayalet-ev MCP Server aktif
📊 Toplam Tool: 77
🔧 Categories: 7
📈 Status: Production Ready
```

**Hata alırsan:** `mcp-server/README.md`'ye bak.

---

## 📊 Proje Durumu Analizi (1 dakika)

```bash
# Basit istatistik
hev_dev_analyze_project(mode: "summary")

# TypeScript error dashboard
hev_dev_typescript_dashboard()
```

**Bu ne işe yarar?**

- Proje büyüklüğünü anlarsın
- Hangi dosyalarda sorun var görürsün
- Öncelik belirleyebilirsin

---

## 📖 5 Dakikalık Okuma (3 dakika)

### 1️⃣ Ana Rehber (1 dakika)

```bash
01-AGENTS.md oku
```

Öğreneceğin:

- ✅ Dil politikası
- ✅ Development guidelines
- ✅ Mod sistemi
- ✅ MCP tool direktifi

### 2️⃣ Orchestration Sistemi (2 dakika)

```bash
02-ATLAS-ORCHESTRATION.md oku
```

Öğreneceğin:

- ✅ Atlas mission
- ✅ Delegation system
- ✅ Verification protocol
- ✅ Session management

---

## 🎯 İlk Görevine Başla

### Senaryo 1: "TypeScript hatalar var" → **[guides/development/20-TYPESCRIPT-SUITE.md](guides/development/20-TYPESCRIPT-SUITE.md)**

**Quick fix:**

```bash
# 1. Dashboard'ı aç
hev_dev_typescript_dashboard()

# 2. En yaygın hatayı düzelt
hev_dev_fix_typescript_batch({
  file_path: "...",
  error_codes: ["TS2532"],
  fix_strategy: "add_guards",
  dry_run: true  # Önce preview
})

# 3. Safe batch refactor
hev_dev_safe_batch_refactor({
  file_path: "...",
  operations: [...],
  verify_after_each: true,
  auto_rollback_on_error: true
})
```

---

### Senaryo 2: "Mimari soru sormak istiyorum" → **[guides/architecture/50-CONCEPTS.md](guides/architecture/50-CONCEPTS.md)**

**Quick fix:**

1. `architecture/40-ARCHITECTURE.md`'yi oku
2. `architecture/55-IPC-COMMUNICATION.md`'yi oku (IPC soruları için)
3. Atlas'ı kullan: `02-ATLAS-ORCHESTRATION.md`

---

### Senaryo 3: "Debug lazım" → **[guides/testing/75-TROUBLESHOOTING.md](guides/testing/75-TROUBLESHOOTING.md)**

**Quick fix:**

```bash
# Electron loglarını oku
hev_read_electron_logs(type: "error")

# Error hint'leri al
hev_get_error_hints(errorMessage: "...")
```

---

## 🔧 Günlük Komutlar

| Komut                   | Ne İşe Yarar           | Kullanım Sıklığı  |
| ----------------------- | ---------------------- | ----------------- |
| `npm start`             | Uygulamayı başlat      | Günlük            |
| `npm run lint`          | ESLint kontrolü        | Commit öncesi     |
| `npm run check-types`   | TypeScript kontrolü    | Commit öncesi     |
| `npm run check`         | Tüm kontroller         | Commit öncesi     |
| `npm run generate:docs` | Dokümantasyon güncelle | Tool eklendiğinde |

---

## 🎭 ROVO Mode Kullanımı

ROVO duruma göre otomatik mod değiştirir. Status bar ile takip et:

| Mod           | Status Bar                   | Kullanım                    |
| ------------- | ---------------------------- | --------------------------- |
| ⚡ QUICK      | `╔══ ⚡ QUICK MODE ══╗`      | Basit syntax, trivial işler |
| 🔧 STANDARD   | `┏━━ 🔧 STANDARD MODE ━━┓`   | Normal geliştirme           |
| 🔬 RESEARCH   | `┌── 🔬 RESEARCH MODE ──┐`   | Web araştırma gerekli       |
| 🧠 ULTRATHINK | `╔══ 🧠 ULTRATHINK MODE ══╗` | Kritik kararlar, mimari     |

---

## 🗺️ Dokümantasyon Haritası

```
.rovo/
├── 00-QUICK-START.md                    # 👈 Buradasın
├── 01-AGENTS.md                         # Ana rehber
├── 02-ATLAS-ORCHESTRATION.md            # Orchestration sistemi
├── guides/                              # Detaylı rehberler
│   ├── development/                     # Geliştirme
│   │   ├── 10-MCP-TOOLS.md             # MCP tool ekosistemi
│   │   ├── 20-TYPESCRIPT-SUITE.md      # TS Helper Suite
│   │   └── 30-WORKFLOWS.md              # Common workflows
│   ├── architecture/                   # Mimari
│   │   ├── 40-ARCHITECTURE.md          # Process architecture
│   │   ├── 50-CONCEPTS.md              # Key concepts
│   │   └── 55-IPC-COMMUNICATION.md     # IPC pattern
│   ├── testing/                        # Test & debugging
│   │   ├── 60-TESTING.md               # Testing workflows
│   │   ├── 70-CDP.md                   # CDP usage
│   │   └── 75-TROUBLESHOOTING.md       # Common problems
│   └── reference/                      # Referans materyalleri
│       ├── 80-AUTO-TRIGGERS.md         # Mod sistemi
│       ├── 81-PERSONA.md               # ROVO persona
│       ├── 82-LOGGING.md               # Log sistemi
│       ├── 83-CONTEXT-MANAGEMENT.md   # Session context
│       └── 84-SAFE-EDITING.md          # Editing best practices
└── _metadata/                          # Otomatik içerik
    ├── TOOL-LIST.md                    # Complete tool list
    ├── VERSION-INFO.md                 # Version bilgisi
    └── ROADMAP.md                      # Özellik roadmap
```

---

## 💡 İpuçları

### ⚡ Verimlilik Hileleri

1. **Auto-completion:** MCP tool'ları yazarken tab tuşuna bas
2. **Context caching:** Aynı dosyayı tekrar okuma, cache kullan
3. **Dry-run mode:** Önce preview, sonra apply
4. **Session resume:** Hatalarda yeni session yerine mevcutu kullan

### 🚨 Yaygın Hatalar

| Hata             | Çözüm                                                 |
| ---------------- | ----------------------------------------------------- |
| "Tool not found" | MCP health check yap                                  |
| "Duplicate line" | `hev_dev_edit_lines` kullan, `find_and_replace` değil |
| "Syntax error"   | `hev_dev_check_syntax` ile kontrol et                 |
| "Build failed"   | `hev_dev_typescript_dashboard` ile error analiz et    |

---

## 📚 Öğrenme Yolculuğu

### Week 1: Temel Akış

- [ ] Day 1: Quick start + 01-AGENTS.md
- [ ] Day 2: 02-ATLAS-ORCHESTRATION.md
- [ ] Day 3: guides/development/10-MCP-TOOLS.md
- [ ] Day 4: guides/development/20-TYPESCRIPT-SUITE.md
- [ ] Day 5: İlk gerçek görev (TypeScript error fix)

### Week 2: Mimari

- [ ] Day 1: guides/architecture/40-ARCHITECTURE.md
- [ ] Day 2: guides/architecture/50-CONCEPTS.md
- [ ] Day 3: guides/architecture/55-IPC-COMMUNICATION.md
- [ ] Day 4: guides/testing/60-TESTING.md
- [ ] Day 5: guides/testing/70-CDP.md

### Week 3: İleri Seviye

- [ ] Day 1: guides/development/30-WORKFLOWS.md
- [ ] Day 2: guides/testing/75-TROUBLESHOOTING.md
- [ ] Day 3-5: Gerçek proje görevleri

---

## 🆘 Yardım İçin

### Sorun Mu Var?

1. **Dokümantasyon:** İlgili dosyayı oku
2. **Not defteri:** `.rovo.bak/notebook.md`'ye bak (eski notlar)
3. **Web search:** `hev_web_search({ query: "..." })`

### İletişim

- **Geliştirici:** Raistlin Majere
- **Proje:** Hayalet-ev (Ghost House)
- **GitHub:** (repo URL)

---

**Sürüm:** 1.0  
**Son Güncelleme:** 2026-01-30  
**Okuma Süresi:** 5 dakika

> _"Hızlı başla, derin öğren."_
