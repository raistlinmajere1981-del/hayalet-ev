/**
 * CharacterOverlay - AI Karakter Profili Yöneticisi
 *
 * Asistan sayfasındaki 🎭 butonu ile açılır.
 * Özellik havuzundan seçim yapılır, .rovo/_metadata/CHARACTER.md'ye kaydedilir.
 */

interface CharacterFeature {
  id: string;
  label: string;
  categoryId: string;
}

interface CharacterCategory {
  id: string;
  label: string;
  icon: string;
  features: CharacterFeature[];
}

interface ConflictPair {
  a: string; // feature id
  b: string; // feature id
}

// === Özellik Havuzu ===
const CATEGORIES: CharacterCategory[] = [
  {
    id: "tone",
    label: "İletişim Tonu",
    icon: "🗣️",
    features: [
      { id: "tone-formal", label: "Resmi", categoryId: "tone" },
      { id: "tone-semiformal", label: "Yarı-resmi", categoryId: "tone" },
      { id: "tone-friendly", label: "Samimi", categoryId: "tone" },
      { id: "tone-casual", label: "Arkadaşça", categoryId: "tone" },
      { id: "tone-emoji-lots", label: "Emoji: Çok", categoryId: "tone" },
      { id: "tone-emoji-few", label: "Emoji: Az", categoryId: "tone" },
      { id: "tone-emoji-none", label: "Emoji: Hiç", categoryId: "tone" },
      { id: "tone-humor-sometimes", label: "Mizah: Zaman zaman", categoryId: "tone" },
      { id: "tone-humor-none", label: "Mizah: Hiç", categoryId: "tone" },
    ],
  },
  {
    id: "style",
    label: "Yanıt Stili",
    icon: "📝",
    features: [
      { id: "style-direct", label: "Direkt sonuca git", categoryId: "style" },
      { id: "style-stepbystep", label: "Adım adım açıkla", categoryId: "style" },
      { id: "style-code-first", label: "Kod önce, açıklama sonra", categoryId: "style" },
      { id: "style-explain-first", label: "Açıklama önce, kod sonra", categoryId: "style" },
      { id: "style-alternatives", label: "Alternatif çözümler sun", categoryId: "style" },
      { id: "style-best-only", label: "Tek en iyi çözümü ver", categoryId: "style" },
      { id: "style-ask-unclear", label: "Belirsizlikte mutlaka sor", categoryId: "style" },
      { id: "style-assume", label: "Varsayımla ilerle", categoryId: "style" },
    ],
  },
  {
    id: "proactivity",
    label: "Proaktiflik",
    icon: "⚡",
    features: [
      { id: "pro-minimal", label: "Sadece isteneni yap", categoryId: "proactivity" },
      { id: "pro-risks", label: "İlgili riskleri belirt", categoryId: "proactivity" },
      { id: "pro-suggest", label: "Bağlantılı iyileştirmeler öner", categoryId: "proactivity" },
      {
        id: "pro-fullanalysis",
        label: "Tam analiz — her kararı yorumla",
        categoryId: "proactivity",
      },
    ],
  },
  {
    id: "detail",
    label: "Detay Seviyesi",
    icon: "🔍",
    features: [
      { id: "detail-minimal", label: "Minimal — sonuç + tek cümle", categoryId: "detail" },
      { id: "detail-normal", label: "Normal — açıklama + önemli notlar", categoryId: "detail" },
      { id: "detail-verbose", label: "Verbose — tüm adımlar + gerekçeler", categoryId: "detail" },
    ],
  },
  {
    id: "language",
    label: "Dil Tercihi",
    icon: "🌐",
    features: [
      { id: "lang-turkish", label: "Türkçe ağırlıklı", categoryId: "language" },
      {
        id: "lang-mixed",
        label: "Teknik terimler İngilizce, açıklama Türkçe",
        categoryId: "language",
      },
      { id: "lang-english", label: "Tam İngilizce", categoryId: "language" },
    ],
  },
  {
    id: "focus",
    label: "Uzmanlık Odağı",
    icon: "🎯",
    features: [
      { id: "focus-frontend", label: "Frontend öncelikli", categoryId: "focus" },
      { id: "focus-backend", label: "Backend öncelikli", categoryId: "focus" },
      { id: "focus-fullstack", label: "Full-stack dengeli", categoryId: "focus" },
      { id: "focus-typescript", label: "TypeScript / tip güvenliği odaklı", categoryId: "focus" },
      { id: "focus-performance", label: "Performans odaklı", categoryId: "focus" },
      { id: "focus-security", label: "Güvenlik odaklı", categoryId: "focus" },
      { id: "focus-ux", label: "UX / kullanıcı deneyimi odaklı", categoryId: "focus" },
    ],
  },
  {
    id: "personality",
    label: "Kişilik",
    icon: "🧩",
    features: [
      { id: "pers-mentor", label: "Mentor — öğretir, gerekçe açıklar", categoryId: "personality" },
      { id: "pers-partner", label: "Ortak — birlikte düşünür", categoryId: "personality" },
      {
        id: "pers-critic",
        label: "Eleştirmen — kodu sorgular, alternatif önerir",
        categoryId: "personality",
      },
      {
        id: "pers-pragmatic",
        label: "Pragmatik — en hızlı çalışanı önerir",
        categoryId: "personality",
      },
      {
        id: "pers-assistant",
        label: "Asistan — sadece yapar, yorum yapmaz",
        categoryId: "personality",
      },
    ],
  },
];

// Flat map: id -> feature
const FEATURE_MAP = new Map<string, CharacterFeature>();
for (const cat of CATEGORIES) {
  for (const f of cat.features) {
    FEATURE_MAP.set(f.id, f);
  }
}

// === Çakışma Çiftleri ===
const CONFLICTS: ConflictPair[] = [
  { a: "style-direct", b: "style-stepbystep" },
  { a: "style-code-first", b: "style-explain-first" },
  { a: "style-alternatives", b: "style-best-only" },
  { a: "style-ask-unclear", b: "style-assume" },
  { a: "detail-minimal", b: "detail-normal" },
  { a: "detail-minimal", b: "detail-verbose" },
  { a: "detail-normal", b: "detail-verbose" },
  { a: "pro-minimal", b: "pro-suggest" },
  { a: "pro-minimal", b: "pro-fullanalysis" },
  { a: "tone-formal", b: "tone-casual" },
  { a: "tone-formal", b: "tone-friendly" },
  { a: "lang-turkish", b: "lang-english" },
  { a: "lang-mixed", b: "lang-english" },
  { a: "tone-emoji-lots", b: "tone-emoji-none" },
  { a: "tone-emoji-few", b: "tone-emoji-lots" },
  { a: "tone-emoji-few", b: "tone-emoji-none" },
];

// === Hazır mesaj ===
const COPY_MESSAGE =
  "Karakter profilin güncellendi. `.rovo/_metadata/CHARACTER.md` dosyasını oku ve bu sessiondan itibaren Aktif Profil bölümündeki özelliklere göre davran.";

const CHARACTER_MD_PATH = ".rovo/_metadata/CHARACTER.md";

export class CharacterOverlay {
  private overlay: HTMLElement | null = null;
  private activeList: HTMLElement | null = null;
  private poolList: HTMLElement | null = null;
  private activeCount: HTMLElement | null = null;
  private conflictsEl: HTMLElement | null = null;
  private conflictText: HTMLElement | null = null;
  private emptyState: HTMLElement | null = null;
  private saveBtn: HTMLButtonElement | null = null;

  // Seçili feature id seti
  private selected: Set<string> = new Set();
  // Kaydedilmiş (disk) durum — değişiklik tespiti için
  private savedSelected: Set<string> = new Set();

  init(): void {
    this.overlay = document.getElementById("character-overlay");
    this.activeList = document.getElementById("character-active-list");
    this.poolList = document.getElementById("character-pool-list");
    this.activeCount = document.getElementById("character-active-count");
    this.conflictsEl = document.getElementById("character-conflicts");
    this.conflictText = document.getElementById("character-conflict-text");
    this.emptyState = document.getElementById("character-empty-state");
    this.saveBtn = document.getElementById("character-save-btn") as HTMLButtonElement | null;

    // Aç/kapat
    document.getElementById("asistan-character-btn")?.addEventListener("click", () => {
      this.open();
    });
    document.getElementById("character-overlay-close")?.addEventListener("click", () => {
      this.close();
    });
    document.getElementById("character-cancel-btn")?.addEventListener("click", () => {
      this.close();
    });

    // Modal dışına tıklama
    this.overlay?.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Kaydet
    this.saveBtn?.addEventListener("click", () => {
      void this.save();
    });

    // Mesajı kopyala
    document.getElementById("character-copy-msg-btn")?.addEventListener("click", () => {
      void navigator.clipboard.writeText(COPY_MESSAGE).then(() => {
        const btn = document.getElementById("character-copy-msg-btn");
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = "✅ Kopyalandı";
          setTimeout(() => {
            btn.textContent = orig;
          }, 2000);
        }
      });
    });

    // Havuzu render et
    this._renderPool();
  }

  private open(): void {
    void this._loadFromDisk().then(() => {
      this._renderActivePanel();
      this._updatePool();
      this._checkConflicts();
      this.overlay?.classList.remove("hidden");
    });
  }

  private close(): void {
    this.overlay?.classList.add("hidden");
    // Değiştirilmemiş vazgeçme: seçimi kaydedilen hale döndür
    this.selected = new Set(this.savedSelected);
  }

  // === Disk okuma ===
  private async _loadFromDisk(): Promise<void> {
    try {
      const api = window.electronAPI;
      if (!api) throw new Error("electronAPI yok");
      const b64 = await api.readFile(CHARACTER_MD_PATH);
      if (b64 == null || b64 === "") {
        this.selected = new Set();
        this.savedSelected = new Set();
        return;
      }
      const content = atob(b64);
      this.selected = this._parseProfile(content);
      this.savedSelected = new Set(this.selected);
    } catch {
      this.selected = new Set();
      this.savedSelected = new Set();
    }
  }

  // CHARACTER.md'den aktif profili parse et
  private _parseProfile(content: string): Set<string> {
    const result = new Set<string>();
    const match = content.match(/<!--PROFILE_START-->([\s\S]*?)<!--PROFILE_END-->/);
    if (!match) return result;

    const block = match[1] ?? "";
    // Her satır: "- Label" formatında
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "));
    for (const line of lines) {
      const label = line.slice(2).trim();
      // Label'dan id bul
      for (const [id, feature] of FEATURE_MAP) {
        if (feature.label === label) {
          result.add(id);
          break;
        }
      }
    }
    return result;
  }

  // === Disk yazma ===
  private async save(): Promise<void> {
    const profileBlock = this._buildProfileBlock();
    const timestamp = new Date().toISOString().split("T")[0] ?? "";

    try {
      const api = window.electronAPI;
      if (!api) throw new Error("electronAPI yok");
      const b64 = await api.readFile(CHARACTER_MD_PATH);
      if (b64 == null || b64 === "") throw new Error("Dosya okunamadı");
      const current = atob(b64);
      const updated = current
        .replace(
          /<!--PROFILE_START-->([\s\S]*?)<!--PROFILE_END-->/,
          `<!--PROFILE_START-->\n${profileBlock}<!--PROFILE_END-->`
        )
        .replace(/> \*Henüz bir profil tanımlanmadı\..*?\*/, "")
        .replace(/\*\*Son güncelleme:\*\* .*/, `**Son güncelleme:** ${timestamp}`);

      await api.fmWriteFileAtomic({ path: CHARACTER_MD_PATH, data: updated, encoding: "utf-8" });
      this.savedSelected = new Set(this.selected);

      // Buton geri bildirimi
      if (this.saveBtn) {
        const orig = this.saveBtn.textContent;
        this.saveBtn.classList.add("saved");
        this.saveBtn.textContent = "✅ Kaydedildi";
        setTimeout(() => {
          if (this.saveBtn) {
            this.saveBtn.classList.remove("saved");
            this.saveBtn.textContent = orig;
          }
        }, 2000);
      }
    } catch (err) {
      console.error("[CharacterOverlay] Kaydetme hatası:", err);
    }
  }

  private _buildProfileBlock(): string {
    if (this.selected.size === 0) return "";

    let block = "";
    for (const cat of CATEGORIES) {
      const activeInCat = cat.features.filter((f) => this.selected.has(f.id));
      if (activeInCat.length === 0) continue;
      block += `\n### ${cat.icon} ${cat.label}\n`;
      for (const f of activeInCat) {
        block += `- ${f.label}\n`;
      }
    }
    return block + "\n";
  }

  // === Havuz render ===
  private _renderPool(): void {
    if (!this.poolList) return;
    this.poolList.innerHTML = "";

    for (const cat of CATEGORIES) {
      const accordion = document.createElement("div");
      accordion.className = "character-accordion";
      accordion.dataset["categoryId"] = cat.id;

      const header = document.createElement("div");
      header.className = "character-accordion-header";
      header.innerHTML = `
        <span class="character-accordion-title">${cat.icon} ${cat.label}</span>
        <span class="character-accordion-meta">
          <span class="character-accordion-badge" data-badge="${cat.id}"></span>
          <span class="character-accordion-chevron">▶</span>
        </span>
      `;
      header.addEventListener("click", () => {
        accordion.classList.toggle("open");
      });

      const body = document.createElement("div");
      body.className = "character-accordion-body";

      for (const feature of cat.features) {
        const item = document.createElement("div");
        item.className = "character-pool-item";
        item.dataset["featureId"] = feature.id;
        item.innerHTML = `
          <span class="character-pool-item-check"></span>
          <span class="character-pool-item-label">${feature.label}</span>
        `;
        item.addEventListener("click", () => {
          this._toggleFeature(feature.id);
        });
        body.appendChild(item);
      }

      accordion.appendChild(header);
      accordion.appendChild(body);
      this.poolList.appendChild(accordion);
    }
  }

  // Havuz görünümünü güncelle (aktif işaretleri)
  private _updatePool(): void {
    if (!this.poolList) return;

    for (const cat of CATEGORIES) {
      let activeCount = 0;
      for (const feature of cat.features) {
        const item = this.poolList.querySelector(`[data-feature-id="${feature.id}"]`);
        if (!item) continue;
        const isActive = this.selected.has(feature.id);
        item.classList.toggle("active", isActive);
        const check = item.querySelector(".character-pool-item-check");
        if (check) check.textContent = isActive ? "✓" : "";
        if (isActive) activeCount++;
      }
      // Badge
      const badge = this.poolList.querySelector(`[data-badge="${cat.id}"]`);
      if (badge) badge.textContent = activeCount > 0 ? String(activeCount) : "";
    }
  }

  // === Toggle ===
  private _toggleFeature(id: string): void {
    if (this.selected.has(id)) {
      this.selected.delete(id);
    } else {
      this.selected.add(id);
    }
    this._renderActivePanel();
    this._updatePool();
    this._checkConflicts();
  }

  // === Aktif panel render ===
  private _renderActivePanel(): void {
    if (!this.activeList) return;

    // Önce sadece grupleri temizle, empty-state'i koru
    const groups = this.activeList.querySelectorAll(".character-group");
    groups.forEach((g) => {
      g.remove();
    });

    const totalActive = this.selected.size;

    if (this.emptyState) {
      this.emptyState.style.display = totalActive === 0 ? "flex" : "none";
    }
    if (this.activeCount) {
      this.activeCount.textContent = `${totalActive} özellik`;
    }

    for (const cat of CATEGORIES) {
      const activeInCat = cat.features.filter((f) => this.selected.has(f.id));
      if (activeInCat.length === 0) continue;

      const group = document.createElement("div");
      group.className = "character-group";

      const label = document.createElement("div");
      label.className = "character-group-label";
      label.textContent = `${cat.icon} ${cat.label}`;

      const chips = document.createElement("div");
      chips.className = "character-group-chips";

      for (const f of activeInCat) {
        const chip = document.createElement("span");
        chip.className = "character-chip";
        chip.title = "Kaldırmak için tıkla";
        chip.innerHTML = `${f.label} <span class="character-chip-remove">✕</span>`;
        chip.addEventListener("click", () => {
          this._toggleFeature(f.id);
        });
        chips.appendChild(chip);
      }

      group.appendChild(label);
      group.appendChild(chips);
      this.activeList.appendChild(group);
    }
  }

  // === Çakışma kontrolü ===
  private _checkConflicts(): void {
    if (!this.conflictsEl || !this.conflictText) return;

    const conflictMessages: string[] = [];
    for (const pair of CONFLICTS) {
      if (this.selected.has(pair.a) && this.selected.has(pair.b)) {
        const fa = FEATURE_MAP.get(pair.a);
        const fb = FEATURE_MAP.get(pair.b);
        if (fa && fb) {
          conflictMessages.push(`“${fa.label}” ile “${fb.label}” çelişiyor`);
        }
      }
    }

    if (conflictMessages.length > 0) {
      this.conflictText.textContent = conflictMessages.join(" • ");
      this.conflictsEl.removeAttribute("hidden");
    } else {
      this.conflictsEl.setAttribute("hidden", "");
    }
  }
}
