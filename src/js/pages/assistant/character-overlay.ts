/**
 * CharacterOverlay - AI character profile manager
 *
 * Opened from the 🎭 button on the Assistant page.
 * Users pick features from the pool and save them to `.rovo/_metadata/CHARACTER.md`.
 */

import type { AppLanguage } from "@shared/i18n.js";
import { AppI18n } from "../../modules/i18n/index.js";
import { translateCatalog } from "../../../../shared/i18n/catalog.js";
import { getBuiltInLanguagePack } from "../../../../shared/i18n/bundled-languages.js";

interface CharacterFeature {
  id: string;
  translationKey: string;
  categoryId: string;
}

interface CharacterCategory {
  id: string;
  translationKey: string;
  icon: string;
  features: CharacterFeature[];
}

interface ConflictPair {
  a: string; // feature id
  b: string; // feature id
}

function characterT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`shell.assistant.characterOverlay.${key}`, params);
}

const PROFILE_LABEL_LOCALES: AppLanguage[] = ["tr", "en"];
const EMPTY_PROFILE_HINT_PATTERN =
  /> \*(Henüz bir profil tanımlanmadı\..*?|No profile has been defined yet\..*?)\*/;
const LAST_UPDATED_PATTERN = /\*\*(Son güncelleme|Last updated):\*\* .*/;

function translateCharacterCatalogKey(
  key: string,
  locale: AppLanguage = AppI18n.getLocale()
): string {
  if (locale === AppI18n.getLocale()) {
    return characterT(key);
  }

  const pack = getBuiltInLanguagePack(locale);
  const fallbackCatalog = getBuiltInLanguagePack("en")?.catalog;
  return pack
    ? translateCatalog(
        pack.catalog,
        `shell.assistant.characterOverlay.${key}`,
        undefined,
        fallbackCatalog
      )
    : characterT(key);
}

function getCategoryLabel(category: CharacterCategory, locale?: AppLanguage): string {
  return translateCharacterCatalogKey(category.translationKey, locale);
}

function getFeatureLabel(feature: CharacterFeature, locale?: AppLanguage): string {
  return translateCharacterCatalogKey(feature.translationKey, locale);
}

function normalizeProfileLabel(label: string): string {
  return label.trim().toLocaleLowerCase("tr-TR");
}

// === Feature Pool ===
const CATEGORIES: CharacterCategory[] = [
  {
    id: "tone",
    translationKey: "categories.tone",
    icon: "🗣️",
    features: [
      { id: "tone-formal", translationKey: "features.toneFormal", categoryId: "tone" },
      { id: "tone-semiformal", translationKey: "features.toneSemiformal", categoryId: "tone" },
      { id: "tone-friendly", translationKey: "features.toneFriendly", categoryId: "tone" },
      { id: "tone-casual", translationKey: "features.toneCasual", categoryId: "tone" },
      { id: "tone-emoji-lots", translationKey: "features.toneEmojiLots", categoryId: "tone" },
      { id: "tone-emoji-few", translationKey: "features.toneEmojiFew", categoryId: "tone" },
      { id: "tone-emoji-none", translationKey: "features.toneEmojiNone", categoryId: "tone" },
      {
        id: "tone-humor-sometimes",
        translationKey: "features.toneHumorSometimes",
        categoryId: "tone",
      },
      { id: "tone-humor-none", translationKey: "features.toneHumorNone", categoryId: "tone" },
    ],
  },
  {
    id: "style",
    translationKey: "categories.style",
    icon: "📝",
    features: [
      { id: "style-direct", translationKey: "features.styleDirect", categoryId: "style" },
      {
        id: "style-stepbystep",
        translationKey: "features.styleStepByStep",
        categoryId: "style",
      },
      { id: "style-code-first", translationKey: "features.styleCodeFirst", categoryId: "style" },
      {
        id: "style-explain-first",
        translationKey: "features.styleExplainFirst",
        categoryId: "style",
      },
      {
        id: "style-alternatives",
        translationKey: "features.styleAlternatives",
        categoryId: "style",
      },
      { id: "style-best-only", translationKey: "features.styleBestOnly", categoryId: "style" },
      {
        id: "style-ask-unclear",
        translationKey: "features.styleAskUnclear",
        categoryId: "style",
      },
      { id: "style-assume", translationKey: "features.styleAssume", categoryId: "style" },
    ],
  },
  {
    id: "proactivity",
    translationKey: "categories.proactivity",
    icon: "⚡",
    features: [
      { id: "pro-minimal", translationKey: "features.proMinimal", categoryId: "proactivity" },
      { id: "pro-risks", translationKey: "features.proRisks", categoryId: "proactivity" },
      { id: "pro-suggest", translationKey: "features.proSuggest", categoryId: "proactivity" },
      {
        id: "pro-fullanalysis",
        translationKey: "features.proFullAnalysis",
        categoryId: "proactivity",
      },
    ],
  },
  {
    id: "detail",
    translationKey: "categories.detail",
    icon: "🔍",
    features: [
      { id: "detail-minimal", translationKey: "features.detailMinimal", categoryId: "detail" },
      { id: "detail-normal", translationKey: "features.detailNormal", categoryId: "detail" },
      { id: "detail-verbose", translationKey: "features.detailVerbose", categoryId: "detail" },
    ],
  },
  {
    id: "language",
    translationKey: "categories.language",
    icon: "🌐",
    features: [
      { id: "lang-turkish", translationKey: "features.langTurkish", categoryId: "language" },
      { id: "lang-mixed", translationKey: "features.langMixed", categoryId: "language" },
      { id: "lang-english", translationKey: "features.langEnglish", categoryId: "language" },
    ],
  },
  {
    id: "focus",
    translationKey: "categories.focus",
    icon: "🎯",
    features: [
      { id: "focus-frontend", translationKey: "features.focusFrontend", categoryId: "focus" },
      { id: "focus-backend", translationKey: "features.focusBackend", categoryId: "focus" },
      { id: "focus-fullstack", translationKey: "features.focusFullstack", categoryId: "focus" },
      {
        id: "focus-typescript",
        translationKey: "features.focusTypescript",
        categoryId: "focus",
      },
      {
        id: "focus-performance",
        translationKey: "features.focusPerformance",
        categoryId: "focus",
      },
      { id: "focus-security", translationKey: "features.focusSecurity", categoryId: "focus" },
      { id: "focus-ux", translationKey: "features.focusUx", categoryId: "focus" },
    ],
  },
  {
    id: "personality",
    translationKey: "categories.personality",
    icon: "🧩",
    features: [
      {
        id: "pers-mentor",
        translationKey: "features.personalityMentor",
        categoryId: "personality",
      },
      {
        id: "pers-partner",
        translationKey: "features.personalityPartner",
        categoryId: "personality",
      },
      {
        id: "pers-critic",
        translationKey: "features.personalityCritic",
        categoryId: "personality",
      },
      {
        id: "pers-pragmatic",
        translationKey: "features.personalityPragmatic",
        categoryId: "personality",
      },
      {
        id: "pers-assistant",
        translationKey: "features.personalityAssistant",
        categoryId: "personality",
      },
    ],
  },
];

const FEATURE_MAP = new Map<string, CharacterFeature>();
const FEATURE_LABEL_INDEX = new Map<string, string>();
for (const cat of CATEGORIES) {
  for (const f of cat.features) {
    FEATURE_MAP.set(f.id, f);
    FEATURE_LABEL_INDEX.set(normalizeProfileLabel(f.id), f.id);
    for (const locale of PROFILE_LABEL_LOCALES) {
      FEATURE_LABEL_INDEX.set(normalizeProfileLabel(getFeatureLabel(f, locale)), f.id);
    }
  }
}

// === Conflict Pairs ===
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

// === Ready Message ===
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

  // Keep a snapshot of the persisted selection so close() can discard local edits.
  private selected: Set<string> = new Set();
  private savedSelected: Set<string> = new Set();
  private unsubscribeI18n: (() => void) | null = null;

  init(): void {
    this.overlay = document.getElementById("character-overlay");
    this.activeList = document.getElementById("character-active-list");
    this.poolList = document.getElementById("character-pool-list");
    this.activeCount = document.getElementById("character-active-count");
    this.conflictsEl = document.getElementById("character-conflicts");
    this.conflictText = document.getElementById("character-conflict-text");
    this.emptyState = document.getElementById("character-empty-state");
    this.saveBtn = document.getElementById("character-save-btn") as HTMLButtonElement | null;

    document.getElementById("assistant-character-btn")?.addEventListener("click", () => {
      this.open();
    });
    document.getElementById("character-overlay-close")?.addEventListener("click", () => {
      this.close();
    });
    document.getElementById("character-cancel-btn")?.addEventListener("click", () => {
      this.close();
    });

    this.overlay?.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.saveBtn?.addEventListener("click", () => {
      void this.save();
    });

    document.getElementById("character-copy-msg-btn")?.addEventListener("click", () => {
      void navigator.clipboard.writeText(characterT("copyPrompt")).then(() => {
        const btn = document.getElementById("character-copy-msg-btn");
        const labelEl = btn?.querySelector<HTMLElement>("[data-character-copy-label]");
        if (btn) {
          const orig = labelEl?.textContent ?? "";
          if (labelEl) {
            labelEl.textContent = characterT("copiedButton");
          }
          setTimeout(() => {
            if (labelEl) {
              labelEl.textContent = orig;
            }
          }, 2000);
        }
      });
    });

    this.unsubscribeI18n ??= AppI18n.subscribe(() => {
      this._renderPool();
      this._renderActivePanel();
      this._checkConflicts();
    });

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
    // Revert untouched changes back to the saved selection
    this.selected = new Set(this.savedSelected);
  }

  // === Disk Read ===
  private async _loadFromDisk(): Promise<void> {
    try {
      const api = window.electronAPI;
      if (!api) throw new Error(characterT("errors.electronApiUnavailable"));
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

  // Parse the active profile from CHARACTER.md
  private _parseProfile(content: string): Set<string> {
    const result = new Set<string>();
    const match = content.match(/<!--PROFILE_START-->([\s\S]*?)<!--PROFILE_END-->/);
    if (!match) return result;

    const block = match[1] ?? "";
    // Each line uses the "- Label" format
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "));
    for (const line of lines) {
      const label = line.slice(2).trim();
      const featureId = FEATURE_LABEL_INDEX.get(normalizeProfileLabel(label));
      if (featureId !== undefined) {
        result.add(featureId);
      }
    }
    return result;
  }

  // === Disk Write ===
  private async save(): Promise<void> {
    const profileBlock = this._buildProfileBlock();
    const timestamp = new Date().toISOString().split("T")[0] ?? "";

    try {
      const api = window.electronAPI;
      if (!api) throw new Error(characterT("errors.electronApiUnavailable"));
      const b64 = await api.readFile(CHARACTER_MD_PATH);
      if (b64 == null || b64 === "") throw new Error(characterT("errors.profileReadFailed"));
      const current = atob(b64);
      const updated = current
        .replace(
          /<!--PROFILE_START-->([\s\S]*?)<!--PROFILE_END-->/,
          `<!--PROFILE_START-->\n${profileBlock}<!--PROFILE_END-->`
        )
        .replace(EMPTY_PROFILE_HINT_PATTERN, "")
        .replace(LAST_UPDATED_PATTERN, (_match, label: string) => `**${label}:** ${timestamp}`);

      await api.fmWriteFileAtomic({ path: CHARACTER_MD_PATH, data: updated, encoding: "utf-8" });
      this.savedSelected = new Set(this.selected);

      // Button feedback
      if (this.saveBtn) {
        const orig = this.saveBtn.textContent;
        this.saveBtn.classList.add("saved");
        this.saveBtn.textContent = characterT("savedButton");
        setTimeout(() => {
          if (this.saveBtn) {
            this.saveBtn.classList.remove("saved");
            this.saveBtn.textContent = orig;
          }
        }, 2000);
      }
    } catch (err) {
      if (this.saveBtn) {
        const originalText = this.saveBtn.textContent;
        this.saveBtn.classList.remove("saved");
        this.saveBtn.textContent = AppI18n.t("shell.assistant.buttonStates.error");
        setTimeout(() => {
          if (this.saveBtn) {
            this.saveBtn.textContent = originalText;
          }
        }, 2000);
      }
      console.error(
        characterT("errors.saveFailed", {
          message: err instanceof Error ? err.message : String(err),
        }),
        err
      );
    }
  }

  private _buildProfileBlock(): string {
    if (this.selected.size === 0) return "";

    let block = "";
    for (const cat of CATEGORIES) {
      const activeInCat = cat.features.filter((f) => this.selected.has(f.id));
      if (activeInCat.length === 0) continue;
      block += `\n### ${cat.icon} ${getCategoryLabel(cat)}\n`;
      for (const f of activeInCat) {
        block += `- ${getFeatureLabel(f)}\n`;
      }
    }
    return block + "\n";
  }

  // === Pool Render ===
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
        <span class="character-accordion-title">${cat.icon} ${getCategoryLabel(cat)}</span>
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
          <span class="character-pool-item-label">${getFeatureLabel(feature)}</span>
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

  // Refresh the pool view (active markers)
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

  // === Active Panel Render ===
  private _renderActivePanel(): void {
    if (!this.activeList) return;

    // Clear only the groups first and preserve the empty state
    const groups = this.activeList.querySelectorAll(".character-group");
    groups.forEach((g) => {
      g.remove();
    });

    const totalActive = this.selected.size;

    if (this.emptyState) {
      this.emptyState.style.display = totalActive === 0 ? "flex" : "none";
    }
    if (this.activeCount) {
      this.activeCount.textContent = characterT("activeCount", { count: totalActive });
    }

    for (const cat of CATEGORIES) {
      const activeInCat = cat.features.filter((f) => this.selected.has(f.id));
      if (activeInCat.length === 0) continue;

      const group = document.createElement("div");
      group.className = "character-group";

      const label = document.createElement("div");
      label.className = "character-group-label";
      label.textContent = `${cat.icon} ${getCategoryLabel(cat)}`;

      const chips = document.createElement("div");
      chips.className = "character-group-chips";

      for (const f of activeInCat) {
        const chip = document.createElement("span");
        chip.className = "character-chip";
        chip.title = characterT("removeTitle");
        chip.innerHTML = `${getFeatureLabel(f)} <span class="character-chip-remove">✕</span>`;
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

  // === Conflict Check ===
  private _checkConflicts(): void {
    if (!this.conflictsEl || !this.conflictText) return;

    const conflictMessages: string[] = [];
    for (const pair of CONFLICTS) {
      if (this.selected.has(pair.a) && this.selected.has(pair.b)) {
        const fa = FEATURE_MAP.get(pair.a);
        const fb = FEATURE_MAP.get(pair.b);
        if (fa && fb) {
          conflictMessages.push(
            characterT("conflictMessage", {
              a: getFeatureLabel(fa),
              b: getFeatureLabel(fb),
            })
          );
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
