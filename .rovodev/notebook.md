# 📓 ROVO Not Defteri

> Session'lar arası kalıcı hafıza - Sorunlar, fikirler, gözlemler

---

## 🐛 BUGS - Tool Hataları & Beklenmeyen Davranışlar

<!-- Format:
### [Tarih] Başlık
- **Durum:** Açık/Çözüldü
- **Öncelik:** Yüksek/Orta/Düşük
- **Detay:** Açıklama
- **Workaround:** Varsa geçici çözüm
-->

### [2026-01-24] create_file Tool Hatası
- **Durum:** Gözlemlendi
- **Öncelik:** Orta
- **Detay:** Uzun içerikli dosya oluşturmada "Failed to generate LLM response" hatası
- **Workaround:** bash heredoc ile dosya oluşturma çalışıyor

---

## 💡 IDEAS - Yeni Tool & İyileştirme Fikirleri

<!-- Format:
### [Tarih] Fikir Başlığı
- **Kategori:** Tool/Protokol/UI/DX
- **Öncelik:** Yüksek/Orta/Düşük
- **Detay:** Açıklama
-->

### [2026-01-24] Rovo Dev CLI Web Entegrasyonu
- **Kategori:** UI
- **Öncelik:** Orta (OpenCode UI tamamlandıktan sonra)
- **Detay:** Atlassian Rovo Dev CLI'nin server mode'u var (`acli rovodev server`). HTTP API + SSE stream ile webview üzerinden kullanılabilir. OpenCode UI tamamlandıktan sonra kopyası üzerine Rovo entegrasyonu yapılacak.
- **API:** `http://localhost:8123/v3/chat/stream` (SSE)
- **Döküman:** https://support.atlassian.com/rovo/docs/use-server-mode-in-rovo-dev-cli/

### [2026-01-24] Multi-Agent Orchestration Sistemi
- **Kategori:** Mimari / Büyük Özellik
- **Öncelik:** Uzun vadeli (Asistan sayfası tamamlandıktan sonra)
- **Detay:** Büyük projelerde paralel AI worker koordinasyonu:
  - Ana session: Orchestrator (proje analizi, task dağıtımı, izleme)
  - Worker session'lar: Her biri bir task üzerinde çalışır
  - Shared state: `.temp/tasks/*.json` dosyaları ile koordinasyon
  - Otomatik spawn: Hayalet-ev asistan UI üzerinden (terminal yerine)
- **Neden Hayalet-ev?**
  - Zaten multi-AI altyapısı var (slot sistemi)
  - Webview + IPC altyapısı hazır
  - OpenCode UI + Rovo entegrasyonu ile genişletilebilir
  - Her asistan slot'u bir "worker" olabilir
- **Temel Konsept:**
  ```
  Asistan Sayfası (Orchestrator)
  ├── Slot 1: OpenCode Worker → Task-001
  ├── Slot 2: Rovo Worker → Task-002  
  ├── Slot 3: OpenCode Worker → Task-003
  └── Merkezi izleme + koordinasyon paneli
  ```
- **Gereksinimler:**
  1. Asistan sayfası + OpenCode UI tamamlanmalı
  2. Rovo Dev entegrasyonu yapılmalı
  3. Task management sistemi tasarlanmalı
  4. Worker arası iletişim protokolü

---

## 🔧 TODO - Sonra Yapılacaklar

<!-- Format:
- [ ] [Öncelik] Açıklama (Tarih)
-->

- [ ] [Orta] create_file hatası araştırılacak (2026-01-24)

---

## 📝 OBSERVATIONS - Pattern'ler & Tekrarlayan Sorunlar

<!-- Format:
### [Tarih] Gözlem Başlığı
- **Sıklık:** Nadir/Ara sıra/Sık
- **Detay:** Açıklama
- **Öneri:** Ne yapılmalı
-->

*Henüz not yok*

---

## 📊 İstatistikler

| Kategori | Açık | Çözüldü |
|----------|------|---------|
| Bugs | 1 | 0 |
| Ideas | 0 | - |
| Todos | 1 | 0 |
| Observations | 0 | - |

---

**Son Güncelleme:** 2026-01-24
