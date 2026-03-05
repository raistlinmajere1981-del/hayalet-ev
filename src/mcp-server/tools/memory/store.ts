import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { DatabaseSync } from "node:sqlite";

const TAG_SEPARATOR = "\u001f";

export interface MemoryStoreOptions {
  databasePath: string;
}

export interface MemoryWriteInput {
  namespace?: string;
  content: string;
  summary?: string;
  sourceProvider?: string;
  memoryType?: string;
  importance?: number;
  pinned?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface MemorySearchInput {
  namespace?: string;
  query?: string;
  sourceProvider?: string;
  tags?: string[];
  limit?: number;
}

export interface MemoryUpdateInput {
  id: string;
  content?: string;
  summary?: string;
  sourceProvider?: string;
  memoryType?: string;
  importance?: number;
  pinned?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface MemoryPruneInput {
  namespace?: string;
  maxItems: number;
  olderThanMs?: number;
}

export interface MemoryStatsInput {
  namespace?: string;
}

export interface MemoryItem {
  id: string;
  namespace: string;
  content: string;
  summary: string | null;
  sourceProvider: string | null;
  memoryType: string;
  importance: number;
  pinned: boolean;
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

export interface MemorySearchResult {
  items: MemoryItem[];
  total: number;
}

export interface MemoryStats {
  totalMemories: number;
  pinnedMemories: number;
  averageImportance: number;
  lastUpdatedAt: number | null;
}

interface MemoryRow {
  id: string;
  namespace: string;
  content: string;
  summary: string | null;
  source_provider: string | null;
  memory_type: string;
  importance: number;
  pinned: number;
  metadata_json: string | null;
  created_at: number;
  updated_at: number;
  last_accessed_at: number;
  access_count: number;
  tags_concat: string | null;
}

function clampImportance(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 3;
  if (value < 1) return 1;
  if (value > 5) return 5;
  return Math.round(value);
}

function normalizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of tags) {
    const tag = raw.trim();
    if (tag === "") continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}

function parseMetadata(metadataJson: string | null): Record<string, unknown> | null {
  if (metadataJson == null) return null;
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    if (
      parsed !== null &&
      parsed !== undefined &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toFtsQuery(raw: string): string {
  const words = raw
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0)
    .map((word) => word.replace(/"/g, '""'));

  if (words.length === 0) return "";
  return words.map((word) => `"${word}"`).join(" AND ");
}

export class MemoryStore {
  private readonly db: DatabaseSync;

  private ftsEnabled = true;

  constructor(options: MemoryStoreOptions) {
    mkdirSync(dirname(options.databasePath), { recursive: true });
    this.db = new DatabaseSync(options.databasePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.initializeSchema();
  }

  close(): void {
    this.db.close();
  }

  writeMemory(input: MemoryWriteInput): MemoryItem {
    const content = input.content.trim();
    if (content === "") {
      throw new Error("content is required");
    }

    const now = Date.now();
    const createdAt = input.createdAt ?? now;
    const updatedAt = input.updatedAt ?? createdAt;
    const id = randomUUID();
    const trimmedNamespace = input.namespace?.trim();
    const namespace =
      trimmedNamespace != null && trimmedNamespace.length > 0 ? trimmedNamespace : "global";
    const trimmedSummary = input.summary?.trim();
    const summary = trimmedSummary != null && trimmedSummary.length > 0 ? trimmedSummary : null;
    const trimmedSourceProvider = input.sourceProvider?.trim();
    const sourceProvider =
      trimmedSourceProvider != null && trimmedSourceProvider.length > 0
        ? trimmedSourceProvider
        : null;
    const trimmedMemoryType = input.memoryType?.trim();
    const memoryType =
      trimmedMemoryType != null && trimmedMemoryType.length > 0 ? trimmedMemoryType : "note";
    const importance = clampImportance(input.importance);
    const pinned = input.pinned === true ? 1 : 0;
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    const tags = normalizeTags(input.tags);

    const insertStmt = this.db.prepare(
      `
        INSERT INTO memories (
          id,
          namespace,
          content,
          summary,
          source_provider,
          memory_type,
          importance,
          pinned,
          metadata_json,
          created_at,
          updated_at,
          last_accessed_at,
          access_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `
    );

    this.db.exec("BEGIN");
    try {
      insertStmt.run(
        id,
        namespace,
        content,
        summary,
        sourceProvider,
        memoryType,
        importance,
        pinned,
        metadataJson,
        createdAt,
        updatedAt,
        updatedAt
      );

      this.replaceTags(id, tags);
      this.syncFtsRow(id);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    const row = this.getMemoryById(id);
    if (!row) {
      throw new Error("failed to read inserted memory");
    }
    return row;
  }

  searchMemory(input: MemorySearchInput): MemorySearchResult {
    const limit = this.normalizeLimit(input.limit);
    const namespace = input.namespace?.trim();
    const sourceProvider = input.sourceProvider?.trim();
    const tags = normalizeTags(input.tags);
    const query = (input.query ?? "*").trim();

    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (namespace != null) {
      conditions.push("m.namespace = ?");
      params.push(namespace);
    }

    if (sourceProvider != null) {
      conditions.push("m.source_provider = ?");
      params.push(sourceProvider);
    }

    if (tags.length > 0) {
      const placeholders = tags.map(() => "?").join(", ");
      conditions.push(
        `m.id IN (
          SELECT memory_id
          FROM memory_tags
          WHERE tag IN (${placeholders})
          GROUP BY memory_id
          HAVING COUNT(DISTINCT tag) = ?
        )`
      );
      for (const tag of tags) params.push(tag);
      params.push(tags.length);
    }

    const isWildcard = query === "" || query === "*";
    let usedLikeFallback = false;

    if (!isWildcard) {
      if (this.ftsEnabled) {
        const ftsQuery = toFtsQuery(query);
        if (ftsQuery !== "") {
          conditions.push(
            "m.id IN (SELECT memory_id FROM memories_fts WHERE memories_fts MATCH ?)"
          );
          params.push(ftsQuery);
        }
      } else {
        conditions.push("(m.content LIKE ? OR COALESCE(m.summary, '') LIKE ?)");
        params.push(`%${query}%`, `%${query}%`);
        usedLikeFallback = true;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        m.id,
        m.namespace,
        m.content,
        m.summary,
        m.source_provider,
        m.memory_type,
        m.importance,
        m.pinned,
        m.metadata_json,
        m.created_at,
        m.updated_at,
        m.last_accessed_at,
        m.access_count,
        (
          SELECT group_concat(tag, '${TAG_SEPARATOR}')
          FROM memory_tags
          WHERE memory_id = m.id
        ) AS tags_concat
      FROM memories m
      ${whereClause}
      ORDER BY m.pinned DESC, m.importance DESC, m.updated_at DESC
      LIMIT ?
    `;

    let rows: MemoryRow[];

    try {
      const stmt = this.db.prepare(sql);
      rows = stmt.all(...params, limit) as unknown as MemoryRow[];
    } catch (error) {
      if (this.ftsEnabled && !isWildcard && !usedLikeFallback) {
        const fallbackConditions = [...conditions];
        const fallbackParams = [...params];
        const ftsParam = fallbackParams.pop();

        if (typeof ftsParam !== "string") {
          throw error;
        }

        const ftsCondition =
          "m.id IN (SELECT memory_id FROM memories_fts WHERE memories_fts MATCH ?)";
        const ftsIndex = fallbackConditions.lastIndexOf(ftsCondition);
        if (ftsIndex < 0) throw error;

        fallbackConditions.splice(
          ftsIndex,
          1,
          "(m.content LIKE ? OR COALESCE(m.summary, '') LIKE ?)"
        );
        fallbackParams.push(`%${query}%`, `%${query}%`);

        const fallbackWhere =
          fallbackConditions.length > 0 ? `WHERE ${fallbackConditions.join(" AND ")}` : "";

        const fallbackSql = `
          SELECT
            m.id,
            m.namespace,
            m.content,
            m.summary,
            m.source_provider,
            m.memory_type,
            m.importance,
            m.pinned,
            m.metadata_json,
            m.created_at,
            m.updated_at,
            m.last_accessed_at,
            m.access_count,
            (
              SELECT group_concat(tag, '${TAG_SEPARATOR}')
              FROM memory_tags
              WHERE memory_id = m.id
            ) AS tags_concat
          FROM memories m
          ${fallbackWhere}
          ORDER BY m.pinned DESC, m.importance DESC, m.updated_at DESC
          LIMIT ?
        `;

        const fallbackStmt = this.db.prepare(fallbackSql);
        rows = fallbackStmt.all(...fallbackParams, limit) as unknown as MemoryRow[];
      } else {
        throw error;
      }
    }

    const items = rows.map((row) => this.mapRow(row));
    this.bumpAccess(items.map((item) => item.id));

    return {
      items,
      total: items.length,
    };
  }

  updateMemory(input: MemoryUpdateInput): boolean {
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.content !== undefined) {
      const content = input.content.trim();
      if (content === "") throw new Error("content cannot be empty");
      updates.push("content = ?");
      params.push(content);
    }

    if (input.summary !== undefined) {
      updates.push("summary = ?");
      params.push(input.summary.trim() !== "" ? input.summary.trim() : null);
    }

    if (input.sourceProvider !== undefined) {
      updates.push("source_provider = ?");
      params.push(input.sourceProvider.trim() !== "" ? input.sourceProvider.trim() : null);
    }

    if (input.memoryType !== undefined) {
      updates.push("memory_type = ?");
      params.push(input.memoryType.trim() !== "" ? input.memoryType.trim() : "note");
    }

    if (input.importance !== undefined) {
      updates.push("importance = ?");
      params.push(clampImportance(input.importance));
    }

    if (input.pinned !== undefined) {
      updates.push("pinned = ?");
      params.push(input.pinned ? 1 : 0);
    }

    if (input.metadata !== undefined) {
      updates.push("metadata_json = ?");
      params.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0 && input.tags === undefined) {
      return false;
    }

    const now = Date.now();
    updates.push("updated_at = ?");
    params.push(now);

    const updateStmt = this.db.prepare(`
      UPDATE memories
      SET ${updates.join(", ")}
      WHERE id = ?
    `);

    const existsStmt = this.db.prepare("SELECT 1 FROM memories WHERE id = ?");

    this.db.exec("BEGIN");
    try {
      let changed = 0;

      if (updates.length > 0) {
        const result = updateStmt.run(...params, input.id);
        changed = Number((result as unknown as { changes: number }).changes);
      }

      if (changed === 0) {
        const exists = existsStmt.get(input.id) as { 1: number } | undefined;
        if (!exists) {
          this.db.exec("ROLLBACK");
          return false;
        }
      }

      if (input.tags !== undefined) {
        this.replaceTags(input.id, normalizeTags(input.tags));
      }

      this.syncFtsRow(input.id);
      this.db.exec("COMMIT");
      return true;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  deleteMemory(id: string): boolean {
    const deleteStmt = this.db.prepare("DELETE FROM memories WHERE id = ?");
    const deleteFtsStmt = this.db.prepare("DELETE FROM memories_fts WHERE memory_id = ?");

    this.db.exec("BEGIN");
    try {
      const result = deleteStmt.run(id);
      const changed = Number((result as unknown as { changes: number }).changes);
      if (changed > 0 && this.ftsEnabled) {
        deleteFtsStmt.run(id);
      }
      this.db.exec("COMMIT");
      return changed > 0;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  pruneMemory(input: MemoryPruneInput): number {
    const maxItems = Math.max(0, Math.floor(input.maxItems));
    const namespace = input.namespace?.trim();
    const threshold = input.olderThanMs;

    const where = namespace != null ? "WHERE namespace = ? AND pinned = 0" : "WHERE pinned = 0";
    const params: (string | number | null)[] = namespace != null ? [namespace] : [];

    const selectStmt = this.db.prepare(`
      SELECT id, updated_at
      FROM memories
      ${where}
      ORDER BY updated_at DESC
    `);

    const rows = selectStmt.all(...params) as unknown as Array<{ id: string; updated_at: number }>;

    const keepIds = new Set(rows.slice(0, maxItems).map((row) => row.id));
    const deleteIds: string[] = [];
    const now = Date.now();

    for (const row of rows) {
      const olderThanThreshold =
        typeof threshold === "number" ? now - row.updated_at > threshold : false;
      const overflow = !keepIds.has(row.id);
      if (olderThanThreshold || overflow) {
        deleteIds.push(row.id);
      }
    }

    if (deleteIds.length === 0) return 0;

    const uniqueDeleteIds = Array.from(new Set(deleteIds));
    const placeholders = uniqueDeleteIds.map(() => "?").join(", ");

    const deleteStmt = this.db.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`);
    const deleteFtsStmt = this.db.prepare(
      `DELETE FROM memories_fts WHERE memory_id IN (${placeholders})`
    );

    this.db.exec("BEGIN");
    try {
      const result = deleteStmt.run(...uniqueDeleteIds);

      if (this.ftsEnabled) {
        deleteFtsStmt.run(...uniqueDeleteIds);
      }

      this.db.exec("COMMIT");
      return Number((result as unknown as { changes: number }).changes);
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  getStats(input: MemoryStatsInput = {}): MemoryStats {
    const namespace = input.namespace?.trim();
    const where = namespace != null ? "WHERE namespace = ?" : "";
    const params: (string | number | null)[] = namespace != null ? [namespace] : [];

    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) AS total_memories,
        SUM(CASE WHEN pinned = 1 THEN 1 ELSE 0 END) AS pinned_memories,
        AVG(importance) AS avg_importance,
        MAX(updated_at) AS last_updated_at
      FROM memories
      ${where}
    `);

    const row = stmt.get(...params) as {
      total_memories: number;
      pinned_memories: number | null;
      avg_importance: number | null;
      last_updated_at: number | null;
    };

    return {
      totalMemories: Number(row.total_memories),
      pinnedMemories: Number(row.pinned_memories),
      averageImportance: row.avg_importance != null ? Number(row.avg_importance.toFixed(2)) : 0,
      lastUpdatedAt: row.last_updated_at ?? null,
    };
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        source_provider TEXT,
        memory_type TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 3,
        pinned INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS memory_tags (
        memory_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (memory_id, tag),
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_memories_namespace_updated
      ON memories(namespace, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_memories_provider
      ON memories(source_provider);

      CREATE INDEX IF NOT EXISTS idx_memories_pinned_importance
      ON memories(pinned DESC, importance DESC, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_memory_tags_tag
      ON memory_tags(tag);
    `);

    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          memory_id UNINDEXED,
          namespace UNINDEXED,
          content,
          summary,
          tags,
          tokenize='unicode61'
        );
      `);
      this.ftsEnabled = true;
    } catch {
      this.ftsEnabled = false;
    }
  }

  private normalizeLimit(limit?: number): number {
    if (typeof limit !== "number" || Number.isNaN(limit)) return 20;
    if (limit < 1) return 1;
    if (limit > 200) return 200;
    return Math.floor(limit);
  }

  private replaceTags(memoryId: string, tags: string[]): void {
    const deleteStmt = this.db.prepare("DELETE FROM memory_tags WHERE memory_id = ?");
    const insertStmt = this.db.prepare(`
      INSERT INTO memory_tags (memory_id, tag)
      VALUES (?, ?)
    `);

    deleteStmt.run(memoryId);
    if (tags.length === 0) return;

    for (const tag of tags) {
      insertStmt.run(memoryId, tag);
    }
  }

  private syncFtsRow(memoryId: string): void {
    if (!this.ftsEnabled) return;

    const selectStmt = this.db.prepare(`
      SELECT
        m.id,
        m.namespace,
        m.content,
        m.summary,
        (
          SELECT group_concat(tag, ' ')
          FROM memory_tags
          WHERE memory_id = m.id
        ) AS tags_text
      FROM memories m
      WHERE m.id = ?
    `);

    const row = selectStmt.get(memoryId) as
      | {
          id: string;
          namespace: string;
          content: string;
          summary: string | null;
          tags_text: string | null;
        }
      | undefined;

    const deleteFtsStmt = this.db.prepare("DELETE FROM memories_fts WHERE memory_id = ?");
    const insertFtsStmt = this.db.prepare(`
      INSERT INTO memories_fts (memory_id, namespace, content, summary, tags)
      VALUES (?, ?, ?, ?, ?)
    `);

    deleteFtsStmt.run(memoryId);

    if (!row) return;

    insertFtsStmt.run(row.id, row.namespace, row.content, row.summary ?? "", row.tags_text ?? "");
  }

  private getMemoryById(id: string): MemoryItem | null {
    const stmt = this.db.prepare(`
      SELECT
        m.id,
        m.namespace,
        m.content,
        m.summary,
        m.source_provider,
        m.memory_type,
        m.importance,
        m.pinned,
        m.metadata_json,
        m.created_at,
        m.updated_at,
        m.last_accessed_at,
        m.access_count,
        (
          SELECT group_concat(tag, '${TAG_SEPARATOR}')
          FROM memory_tags
          WHERE memory_id = m.id
        ) AS tags_concat
      FROM memories m
      WHERE m.id = ?
    `);

    const row = stmt.get(id) as MemoryRow | undefined;

    if (!row) return null;
    return this.mapRow(row);
  }

  private mapRow(row: MemoryRow): MemoryItem {
    return {
      id: row.id,
      namespace: row.namespace,
      content: row.content,
      summary: row.summary,
      sourceProvider: row.source_provider,
      memoryType: row.memory_type,
      importance: row.importance,
      pinned: row.pinned === 1,
      tags: row.tags_concat != null ? row.tags_concat.split(TAG_SEPARATOR).filter(Boolean) : [],
      metadata: parseMetadata(row.metadata_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at,
      accessCount: row.access_count,
    };
  }

  private bumpAccess(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed_at = ?
      WHERE id IN (${placeholders})
    `);
    stmt.run(now, ...ids);
  }
}
