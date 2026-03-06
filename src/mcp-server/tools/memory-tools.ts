import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { MemoryItem, MemorySearchResult, MemoryStats } from "./memory/store.js";
import { MemoryStore } from "./memory/store.js";

interface MemoryStoreWriteArgs {
  namespace?: string;
  content?: string;
  summary?: string;
  source_provider?: string;
  memory_type?: string;
  importance?: number;
  pinned?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface MemoryStoreSearchArgs {
  namespace?: string;
  query?: string;
  source_provider?: string;
  tags?: string[];
  limit?: number;
  response_format?: "json" | "prompt_compact";
  budget_chars?: number;
}

interface MemoryStoreUpdateArgs {
  id?: string;
  content?: string;
  summary?: string;
  source_provider?: string;
  memory_type?: string;
  importance?: number;
  pinned?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface MemoryStoreDeleteArgs {
  id?: string;
}

interface MemoryStorePruneArgs {
  namespace?: string;
  max_items?: number;
  older_than_days?: number;
}

interface MemoryStoreStatsArgs {
  namespace?: string;
}

interface MemoryBootstrapPolicyArgs {
  namespace?: string;
  files?: string[];
  max_chunk_chars?: number;
  force?: boolean;
}

interface PromptCompactItem {
  id: string;
  score: number;
  type: string;
  importance: number;
  pinned: boolean;
  source_provider: string;
  tags: string[];
  reason: string;
  summary: string;
  content: string;
}

interface MemorySearchResponse extends MemorySearchResult {
  selected_count: number;
  budget_chars: number;
  used_chars: number;
  prompt_items: PromptCompactItem[];
  prompt_context: string;
}

interface MemoryBootstrapPolicyReport {
  namespace: string;
  files_requested: number;
  files_processed: number;
  total_chunks: number;
  inserted: number;
  updated: number;
  skipped: number;
  missing_files: string[];
}

const DEFAULT_POLICY_FILES = [
  "AGENTS.md",
  ".rovo/00-ONBOARDING.md",
  ".rovo/01-CORE-PROTOCOL.md",
  ".rovo/02-MCP-ESSENTIALS.md",
  ".rovo/03-ARCHITECTURE.md",
];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeFileTag(pathValue: string): string {
  return pathValue
    .replace(/\\/g, "/")
    .toLowerCase()
    .replace(/[^a-z0-9/._-]+/g, "-")
    .replace(/\//g, "_")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function splitIntoChunks(content: string, maxChars: number): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (normalized === "") return [];

  const chunks: string[] = [];
  const blocks = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  let current = "";

  for (const block of blocks) {
    if (block.length > maxChars) {
      if (current !== "") {
        chunks.push(current);
        current = "";
      }
      for (let cursor = 0; cursor < block.length; cursor += maxChars) {
        chunks.push(block.slice(cursor, cursor + maxChars));
      }
      continue;
    }

    const merged = current !== "" ? `${current}\n\n${block}` : block;
    if (merged.length > maxChars) {
      if (current !== "") chunks.push(current);
      current = block;
    } else {
      current = merged;
    }
  }

  if (current !== "") chunks.push(current);
  return chunks;
}

function oneLine(value: string, maxChars: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function typeRank(memoryType: string): number {
  if (memoryType === "policy") return 400;
  if (memoryType === "fact") return 300;
  if (memoryType === "task") return 200;
  return 100;
}

function computeScore(item: MemoryItem, now: number): number {
  const ageMs = Math.max(0, now - item.updatedAt);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const recencyScore = Math.max(0, 30 - ageDays);
  return typeRank(item.memoryType) + item.importance * 20 + (item.pinned ? 40 : 0) + recencyScore;
}

function buildReason(item: MemoryItem): string {
  if (item.memoryType === "policy") return "policy";
  if (item.pinned) return "pinned";
  if (item.importance >= 4) return "high-importance";
  return "relevant";
}

function buildPromptCompactPayload(
  result: MemorySearchResult,
  query: string,
  budgetChars: number
): {
  selected_count: number;
  used_chars: number;
  prompt_items: PromptCompactItem[];
  prompt_context: string;
} {
  const now = Date.now();
  const ranked = [...result.items]
    .map((item) => ({ item, score: computeScore(item, now) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.item.updatedAt - left.item.updatedAt;
    });

  const selected: PromptCompactItem[] = [];
  let usedChars = 0;

  for (const entry of ranked) {
    const summary = oneLine(entry.item.summary ?? "", 120);
    const content = oneLine(entry.item.content, 220);
    const sourceProvider = entry.item.sourceProvider ?? "n/a";
    const row = `[id=${entry.item.id} score=${entry.score.toFixed(1)} type=${entry.item.memoryType} imp=${entry.item.importance} pinned=${entry.item.pinned ? 1 : 0} provider=${sourceProvider} reason=${buildReason(entry.item)} tags=${entry.item.tags.join(",")}] summary=${summary !== "" ? summary : "-"} content=${content}`;
    const rowCost = row.length + 4;

    if (usedChars + rowCost > budgetChars && selected.length > 0) break;

    selected.push({
      id: entry.item.id,
      score: Number(entry.score.toFixed(1)),
      type: entry.item.memoryType,
      importance: entry.item.importance,
      pinned: entry.item.pinned,
      source_provider: sourceProvider,
      tags: entry.item.tags,
      reason: buildReason(entry.item),
      summary: summary !== "" ? summary : "-",
      content,
    });
    usedChars += rowCost;
  }

  const lines = [
    "[MEMORY_CONTEXT v1]",
    `query=${query !== "" ? query : "*"} hits=${result.total} selected=${selected.length} budget_chars=${budgetChars} used_chars=${usedChars}`,
    "items:",
    ...selected.map(
      (item) =>
        `- id=${item.id} score=${item.score} type=${item.type} imp=${item.importance} pinned=${item.pinned ? 1 : 0} provider=${item.source_provider} reason=${item.reason} tags=${item.tags.join(",") !== "" ? item.tags.join(",") : "-"}\n  summary: ${item.summary}\n  content: ${item.content}`
    ),
    "[/MEMORY_CONTEXT]",
  ];

  return {
    selected_count: selected.length,
    used_chars: usedChars,
    prompt_items: selected,
    prompt_context: lines.join("\n"),
  };
}

const storePool = new Map<string, MemoryStore>();

function getStore(projectRoot: string): MemoryStore {
  const dbPath = join(projectRoot, "data", "shared", "assistant-memory.db");
  const existing = storePool.get(dbPath);
  if (existing) return existing;

  const store = new MemoryStore({ databasePath: dbPath });
  storePool.set(dbPath, store);
  return store;
}

export async function memoryWrite(
  projectRoot: string,
  args: MemoryStoreWriteArgs
): Promise<{ message: string; memory: MemoryItem }> {
  const content = args.content?.trim();
  if (content == null || content === "") throw new Error("content is required");

  const store = getStore(projectRoot);
  const memory = await store.writeMemory({
    ...(args.namespace !== undefined ? { namespace: args.namespace } : {}),
    content,
    ...(args.summary !== undefined ? { summary: args.summary } : {}),
    ...(args.source_provider !== undefined ? { sourceProvider: args.source_provider } : {}),
    ...(args.memory_type !== undefined ? { memoryType: args.memory_type } : {}),
    ...(args.importance !== undefined ? { importance: args.importance } : {}),
    ...(args.pinned !== undefined ? { pinned: args.pinned } : {}),
    ...(args.tags !== undefined ? { tags: args.tags } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
  });

  return {
    message: `✅ Memory kaydedildi: ${memory.id}`,
    memory,
  };
}

export async function memorySearch(
  projectRoot: string,
  args: MemoryStoreSearchArgs
): Promise<MemorySearchResponse> {
  const store = getStore(projectRoot);
  let raw = await store.searchMemory({
    ...(args.namespace !== undefined ? { namespace: args.namespace } : {}),
    ...(args.query !== undefined ? { query: args.query } : {}),
    ...(args.source_provider !== undefined ? { sourceProvider: args.source_provider } : {}),
    ...(args.tags !== undefined ? { tags: args.tags } : {}),
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
  });

  const query = (args.query ?? "*").trim() !== "" ? (args.query ?? "*").trim() : "*";
  if (raw.total === 0 && query !== "*") {
    raw = await store.searchMemory({
      ...(args.namespace !== undefined ? { namespace: args.namespace } : {}),
      query: "*",
      ...(args.source_provider !== undefined ? { sourceProvider: args.source_provider } : {}),
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
    });
  }

  const budgetChars =
    typeof args.budget_chars === "number" && Number.isFinite(args.budget_chars)
      ? Math.max(200, Math.floor(args.budget_chars))
      : 2200;

  const payload = buildPromptCompactPayload(raw, query, budgetChars);
  return {
    ...raw,
    budget_chars: budgetChars,
    selected_count: payload.selected_count,
    used_chars: payload.used_chars,
    prompt_items: payload.prompt_items,
    prompt_context: payload.prompt_context,
  };
}

export async function memoryUpdate(
  projectRoot: string,
  args: MemoryStoreUpdateArgs
): Promise<{ updated: boolean; id: string }> {
  if (args.id == null || args.id.trim() === "") throw new Error("id is required");

  const store = getStore(projectRoot);
  const updated = await store.updateMemory({
    id: args.id,
    ...(args.content !== undefined ? { content: args.content } : {}),
    ...(args.summary !== undefined ? { summary: args.summary } : {}),
    ...(args.source_provider !== undefined ? { sourceProvider: args.source_provider } : {}),
    ...(args.memory_type !== undefined ? { memoryType: args.memory_type } : {}),
    ...(args.importance !== undefined ? { importance: args.importance } : {}),
    ...(args.pinned !== undefined ? { pinned: args.pinned } : {}),
    ...(args.tags !== undefined ? { tags: args.tags } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
  });

  return { updated, id: args.id };
}

export async function memoryDelete(
  projectRoot: string,
  args: MemoryStoreDeleteArgs
): Promise<{ deleted: boolean; id: string }> {
  if (args.id == null || args.id.trim() === "") throw new Error("id is required");
  const store = getStore(projectRoot);
  const deleted = await store.deleteMemory(args.id);
  return { deleted, id: args.id };
}

export async function memoryPrune(
  projectRoot: string,
  args: MemoryStorePruneArgs
): Promise<{ removed: number; maxItems: number }> {
  const store = getStore(projectRoot);
  const maxItems =
    typeof args.max_items === "number" && Number.isFinite(args.max_items)
      ? Math.max(0, Math.floor(args.max_items))
      : 500;

  const olderThanMs =
    typeof args.older_than_days === "number" && Number.isFinite(args.older_than_days)
      ? Math.max(0, Math.floor(args.older_than_days)) * 24 * 60 * 60 * 1000
      : undefined;

  const removed = await store.pruneMemory({
    ...(args.namespace !== undefined ? { namespace: args.namespace } : {}),
    maxItems,
    ...(olderThanMs !== undefined ? { olderThanMs } : {}),
  });

  return { removed, maxItems };
}

export async function memoryStats(
  projectRoot: string,
  args: MemoryStoreStatsArgs
): Promise<MemoryStats> {
  const store = getStore(projectRoot);
  return await store.getStats({
    ...(args.namespace !== undefined ? { namespace: args.namespace } : {}),
  });
}

export async function memoryBootstrapPolicy(
  projectRoot: string,
  args: MemoryBootstrapPolicyArgs = {}
): Promise<MemoryBootstrapPolicyReport> {
  const store = getStore(projectRoot);
  const trimmedNamespace = args.namespace?.trim();
  const namespace =
    trimmedNamespace != null && trimmedNamespace !== "" && trimmedNamespace.length > 0
      ? trimmedNamespace
      : "policy";
  const files =
    Array.isArray(args.files) && args.files.length > 0 ? args.files : DEFAULT_POLICY_FILES;
  const force = args.force === true;
  const maxChunkChars =
    typeof args.max_chunk_chars === "number" && Number.isFinite(args.max_chunk_chars)
      ? Math.max(200, Math.floor(args.max_chunk_chars))
      : 1400;

  let filesProcessed = 0;
  let totalChunks = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const missingFiles: string[] = [];

  for (const relPath of files) {
    const normalizedRelPath = relPath.replace(/^\.\//, "");
    const absolutePath = join(projectRoot, normalizedRelPath);
    if (!existsSync(absolutePath)) {
      missingFiles.push(normalizedRelPath);
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    const chunks = splitIntoChunks(content, maxChunkChars);
    if (chunks.length === 0) continue;
    filesProcessed++;

    const safeFileTag =
      sanitizeFileTag(normalizedRelPath) !== ""
        ? sanitizeFileTag(normalizedRelPath)
        : "policy-file";

    /* eslint-disable no-await-in-loop */
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index] ?? "";
      if (chunk === "") continue;

      totalChunks++;
      const fileTag = `policy-file:${safeFileTag}`;
      const chunkTag = `policy-chunk:${index + 1}`;
      const tags = ["policy", fileTag, chunkTag];
      const chunkHash = sha256(chunk);
      const summary = `${normalizedRelPath} (${index + 1}/${chunks.length})`;
      const metadata = {
        source_file: normalizedRelPath,
        chunk_index: index + 1,
        chunk_total: chunks.length,
        content_hash: chunkHash,
        bootstrap_version: 1,
      };

      const existing = (
        await store.searchMemory({
          namespace,
          query: "*",
          tags: [fileTag, chunkTag],
          limit: 1,
        })
      ).items[0];

      if (!existing) {
        await store.writeMemory({
          namespace,
          content: chunk,
          summary,
          sourceProvider: "system-policy",
          memoryType: "policy",
          importance: 5,
          pinned: true,
          tags,
          metadata,
        });
        inserted++;
        continue;
      }

      const previousHash =
        existing.metadata && typeof existing.metadata["content_hash"] === "string"
          ? existing.metadata["content_hash"]
          : null;

      if (!force && previousHash === chunkHash) {
        skipped++;
        continue;
      }

      const didUpdate = await store.updateMemory({
        id: existing.id,
        content: chunk,
        summary,
        sourceProvider: "system-policy",
        memoryType: "policy",
        importance: 5,
        pinned: true,
        tags,
        metadata,
      });

      if (didUpdate) {
        updated++;
      } else {
        await store.writeMemory({
          namespace,
          content: chunk,
          summary,
          sourceProvider: "system-policy",
          memoryType: "policy",
          importance: 5,
          pinned: true,
          tags,
          metadata,
        });
        inserted++;
      }
    }
    /* eslint-enable no-await-in-loop */
  }

  return {
    namespace,
    files_requested: files.length,
    files_processed: filesProcessed,
    total_chunks: totalChunks,
    inserted,
    updated,
    skipped,
    missing_files: missingFiles,
  };
}

export const MEMORY_TOOL_DEFINITIONS = [
  {
    name: "hev_memory_write",
    description: "libSQL tabanli ortak hafizaya yeni kayit ekle (provider-bagimsiz).",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Memory namespace (varsayilan: global)",
          default: "global",
        },
        content: {
          type: "string",
          description: "Kaydedilecek hafiza metni",
        },
        summary: {
          type: "string",
          description: "Kisa ozet (opsiyonel)",
        },
        source_provider: {
          type: "string",
          description: "Kaydi olusturan provider (opencode vb.)",
        },
        memory_type: {
          type: "string",
          enum: ["note", "fact", "policy", "task"],
          description: "Hafiza tipi",
          default: "note",
        },
        importance: {
          type: "number",
          description: "Onem seviyesi (1-5)",
          default: 3,
          minimum: 1,
          maximum: 5,
        },
        pinned: {
          type: "boolean",
          description: "Silinmeye karsi koruma",
          default: false,
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Etiket listesi",
        },
        metadata: {
          type: "object",
          description: "Ek metadata objesi",
        },
      },
      required: ["content"],
    },
    metadata: {
      category: "memory",
      subcategory: "write",
      priority: "high",
      complexity: "simple",
      useCases: ["Kalici hafiza kaydi", "Providerlar arasi ortak context"],
      relatedTools: ["hev_memory_search", "hev_memory_update", "hev_memory_stats"],
      agentGuidance: "Yeni bilgi/fact kaydederken kullan. Kisa ve atomik kayitlar yaz.",
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["memory", "libsql", "shared-context", "write"],
    },
  },
  {
    name: "hev_memory_search",
    description: "Ortak hafizayi ara ve prompt-uyumlu kisa context formatiyla dondur.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Arama namespace'i",
          default: "global",
        },
        query: {
          type: "string",
          description: "Arama ifadesi (tum kayitlar icin '*')",
          default: "*",
        },
        source_provider: {
          type: "string",
          description: "Provider filtresi",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tum etiketlerle eslesme (AND)",
        },
        limit: {
          type: "number",
          description: "Donulecek maksimum kayit",
          default: 20,
          minimum: 1,
          maximum: 200,
        },
        response_format: {
          type: "string",
          enum: ["json", "prompt_compact"],
          description: "Cikti formati",
          default: "prompt_compact",
        },
        budget_chars: {
          type: "number",
          description: "Prompt context icin karakter butcesi",
          default: 2200,
          minimum: 200,
          maximum: 12000,
        },
      },
    },
    metadata: {
      category: "memory",
      subcategory: "search",
      priority: "high",
      complexity: "simple",
      useCases: [
        "Prompt oncesi hafiza cekme",
        "Providerlar arasi context aktarimi",
        "Kisa ve standart memory context uretimi",
      ],
      relatedTools: ["hev_memory_write", "hev_memory_stats"],
      agentGuidance: "Yeni kayit yazmadan once arama yaparak tekrar eden bilgi olusumunu azalt.",
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["memory", "libsql", "search"],
    },
  },
  {
    name: "hev_memory_update",
    description: "Mevcut memory kaydini guncelle (icerik, etiket, onem, pinned).",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Guncellenecek memory id",
        },
        content: {
          type: "string",
          description: "Yeni icerik",
        },
        summary: {
          type: "string",
          description: "Yeni ozet",
        },
        source_provider: {
          type: "string",
          description: "Yeni provider bilgisi",
        },
        memory_type: {
          type: "string",
          enum: ["note", "fact", "policy", "task"],
          description: "Yeni memory tipi",
        },
        importance: {
          type: "number",
          description: "Yeni onem seviyesi (1-5)",
          minimum: 1,
          maximum: 5,
        },
        pinned: {
          type: "boolean",
          description: "Pinned durumu",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Yeni etiket listesi",
        },
        metadata: {
          type: "object",
          description: "Metadata override",
        },
      },
      required: ["id"],
    },
    metadata: {
      category: "memory",
      subcategory: "update",
      priority: "medium",
      complexity: "simple",
      useCases: ["Bilgi duzeltme", "Etiket duzenleme"],
      relatedTools: ["hev_memory_search", "hev_memory_write"],
      agentGuidance: "Yalnizca ilgili alanlari guncelle. Once hev_memory_search ile kaydi dogrula.",
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["memory", "update", "libsql"],
    },
  },
  {
    name: "hev_memory_delete",
    description: "Belirli bir memory kaydini sil.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Silinecek memory id",
        },
      },
      required: ["id"],
    },
    metadata: {
      category: "memory",
      subcategory: "delete",
      priority: "medium",
      complexity: "simple",
      useCases: ["Hatali kayit temizligi"],
      relatedTools: ["hev_memory_search"],
      agentGuidance: "Silmeden once kaydi arayip dogrula.",
      requiresConfirmation: false,
      riskLevel: "medium",
      tags: ["memory", "delete", "libsql"],
    },
  },
  {
    name: "hev_memory_prune",
    description: "Non-pinned memory kayitlarini limit ve yas kuralina gore temizle.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Temizlenecek namespace",
          default: "global",
        },
        max_items: {
          type: "number",
          description: "Tutulacak maksimum non-pinned kayit sayisi",
          default: 500,
          minimum: 0,
        },
        older_than_days: {
          type: "number",
          description: "Bu gunden daha eski kayitlar aday olur",
          minimum: 0,
        },
      },
    },
    metadata: {
      category: "memory",
      subcategory: "maintenance",
      priority: "medium",
      complexity: "simple",
      useCases: ["Context bloat kontrolu", "Periyodik memory temizlik"],
      relatedTools: ["hev_memory_stats", "hev_memory_search"],
      agentGuidance: "Pinned kayitlar korunur. Prune once stats ile izlenmeli.",
      requiresConfirmation: false,
      riskLevel: "medium",
      tags: ["memory", "prune", "maintenance"],
    },
  },
  {
    name: "hev_memory_stats",
    description: "Memory veritabaninin ozet istatistiklerini getir.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Istatistik namespace filtresi",
          default: "global",
        },
      },
    },
    metadata: {
      category: "memory",
      subcategory: "stats",
      priority: "low",
      complexity: "simple",
      useCases: ["Memory buyukluk kontrolu", "Bakim oncesi durum"],
      relatedTools: ["hev_memory_prune", "hev_memory_search"],
      agentGuidance: "Prune ve tuning oncesi/sonrasi karsilastirma icin kullan.",
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["memory", "stats", "libsql"],
    },
  },
  {
    name: "hev_memory_bootstrap_policy",
    description: "AGENTS.md ve .rovo policy dokumanlarini pinned memory kayitlarina upsert eder.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Policy memory namespace",
          default: "policy",
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Yuklenecek policy dosyalari",
        },
        max_chunk_chars: {
          type: "number",
          description: "Parca basina maksimum karakter",
          default: 1400,
          minimum: 200,
          maximum: 6000,
        },
        force: {
          type: "boolean",
          description: "Hash ayni olsa bile guncellemeyi zorla",
          default: false,
        },
      },
    },
    metadata: {
      category: "memory",
      subcategory: "bootstrap",
      priority: "high",
      complexity: "simple",
      useCases: [
        "AGENTS.md kurallarini memory'ye pinleme",
        "Policy context'i providerlar arasi standardize etme",
      ],
      relatedTools: ["hev_memory_search", "hev_memory_stats", "hev_memory_update"],
      agentGuidance: "Session basinda policy memory guncellemesi icin calistir.",
      requiresConfirmation: false,
      riskLevel: "low",
      tags: ["memory", "policy", "bootstrap", "pinned"],
    },
  },
];
