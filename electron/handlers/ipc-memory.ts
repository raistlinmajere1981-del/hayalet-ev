/**
 * IPC Memory Handlers
 *
 * IPC handlers for memory store operations.
 * Uses the same shared memory DB as the MCP server: data/shared/assistant-memory.db
 */

import { join } from "path";
import { registerHandler } from "./ipc-helpers.ts";
import { Paths } from "../paths.ts";
import {
  MemoryStore,
  type MemoryPruneInput,
  type MemorySearchInput,
  type MemoryStatsInput,
  type MemoryUpdateInput,
  type MemoryWriteInput,
} from "../../src/mcp-server/tools/memory/store.js";

let _store: MemoryStore | null = null;

function getStore(): MemoryStore {
  if (_store) return _store;
  const dbPath = join(Paths.getDataDir(), "shared", "assistant-memory.db");
  _store = new MemoryStore({ databasePath: dbPath });
  return _store;
}

export function setupMemoryHandlers(): void {
  // Search / list
  registerHandler(
    "memory-search",
    async (
      _event,
      params: {
        namespace?: string;
        query?: string;
        sourceProvider?: string;
        tags?: string[];
        limit?: number;
      }
    ) => {
      try {
        const store = getStore();
        const searchArg: MemorySearchInput = { limit: params.limit ?? 100 };
        if (params.namespace !== undefined) searchArg["namespace"] = params.namespace;
        if (params.query !== undefined) searchArg["query"] = params.query;
        if (params.sourceProvider !== undefined)
          searchArg["sourceProvider"] = params.sourceProvider;
        if (params.tags !== undefined) searchArg["tags"] = params.tags;
        const result = await store.searchMemory(searchArg);
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  // Stats
  registerHandler("memory-stats", async (_event, params: { namespace?: string }) => {
    try {
      const store = getStore();
      const statsArg: MemoryStatsInput = {};
      if (params.namespace !== undefined) statsArg["namespace"] = params.namespace;
      const result = await store.getStats(statsArg);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Delete single
  registerHandler("memory-delete", async (_event, params: { id: string }) => {
    try {
      const store = getStore();
      const deleted = await store.deleteMemory(params.id);
      return { success: true, deleted };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Update (pin, importance, content, tags)
  registerHandler(
    "memory-update",
    async (
      _event,
      params: {
        id: string;
        content?: string;
        summary?: string;
        importance?: number;
        pinned?: boolean;
        tags?: string[];
        memoryType?: string;
      }
    ) => {
      try {
        const store = getStore();
        const updateArg: MemoryUpdateInput = { id: params.id };
        if (params.content !== undefined) updateArg["content"] = params.content;
        if (params.summary !== undefined) updateArg["summary"] = params.summary;
        if (params.importance !== undefined) updateArg["importance"] = params.importance;
        if (params.pinned !== undefined) updateArg["pinned"] = params.pinned;
        if (params.tags !== undefined) updateArg["tags"] = params.tags;
        if (params.memoryType !== undefined) updateArg["memoryType"] = params.memoryType;
        const updated = await store.updateMemory(updateArg);
        return { success: true, updated };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  // Write new
  registerHandler(
    "memory-write",
    async (
      _event,
      params: {
        namespace?: string;
        content: string;
        summary?: string;
        sourceProvider?: string;
        memoryType?: string;
        importance?: number;
        pinned?: boolean;
        tags?: string[];
      }
    ) => {
      try {
        const store = getStore();
        const writeArg: MemoryWriteInput = { content: params.content };
        if (params.namespace !== undefined) writeArg["namespace"] = params.namespace;
        if (params.summary !== undefined) writeArg["summary"] = params.summary;
        if (params.sourceProvider !== undefined) writeArg["sourceProvider"] = params.sourceProvider;
        if (params.memoryType !== undefined) writeArg["memoryType"] = params.memoryType;
        if (params.importance !== undefined) writeArg["importance"] = params.importance;
        if (params.pinned !== undefined) writeArg["pinned"] = params.pinned;
        if (params.tags !== undefined) writeArg["tags"] = params.tags;
        const item = await store.writeMemory(writeArg);
        return { success: true, data: item };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  // Prune
  registerHandler(
    "memory-prune",
    async (
      _event,
      params: {
        namespace?: string;
        maxItems: number;
        olderThanDays?: number;
      }
    ) => {
      try {
        const store = getStore();
        const olderThanMs =
          params.olderThanDays != null ? params.olderThanDays * 24 * 60 * 60 * 1000 : undefined;
        const pruneArg: MemoryPruneInput = { maxItems: params.maxItems };
        if (params.namespace !== undefined) pruneArg["namespace"] = params.namespace;
        if (olderThanMs !== undefined) pruneArg["olderThanMs"] = olderThanMs;
        const deleted = await store.pruneMemory(pruneArg);
        return { success: true, deleted };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  // Delete all (namespace-based)
  registerHandler("memory-delete-all", async (_event, params: { namespace?: string }) => {
    try {
      const store = getStore();
      // Fetch everything, then delete
      const searchAllArg: MemorySearchInput = { limit: 200 };
      if (params.namespace !== undefined) searchAllArg["namespace"] = params.namespace;
      const result = await store.searchMemory(searchAllArg);
      let count = 0;
      /* eslint-disable no-await-in-loop */
      for (const item of result.items) {
        if (await store.deleteMemory(item.id)) count++;
      }
      /* eslint-enable no-await-in-loop */
      return { success: true, deleted: count };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
