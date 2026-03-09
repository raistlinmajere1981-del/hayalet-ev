/**
 * Unified Tool Registry - Single Source of Truth
 *
 * Holds all tool definition + handler pairs in a single Map.
 * - Definitions and handlers always stay in sync
 * - Duplicate registration is impossible (build-time + runtime protection)
 * - Counts are calculated at runtime (no hardcoding)
 * - Missing definitions/handlers become TypeScript compile errors
 *
 * @version 3.0.0
 */

// ─── Types ───────────────────────────────────────────────

/** Tool handler function signature */
export type ToolHandler = (args?: Record<string, unknown>) => unknown;

/** Tool definition shape (compatible with MCP SDK + enhanced metadata) */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * A single tool entry: definition + handler co-located.
 * Uses permissive typing for definition to accept various tool definition shapes
 * from different modules. Runtime validation in registerTools() ensures correctness.
 */
export type ToolEntryDefinition = unknown;

export interface ToolEntry {
  definition: ToolEntryDefinition;
  handler: ToolHandler;
}

/** Context passed to tool module factories */
export interface ToolContext {
  PROJECT_ROOT: string;
  LOG_DIR: string;
}

/** Tool module factory function signature */
export type ToolModuleFactory = (context: ToolContext) => ToolEntry[];

// ─── Registry ────────────────────────────────────────────

const definitionMap = new Map<string, ToolEntryDefinition>();
const handlerMap = new Map<string, ToolHandler>();

/**
 * Register tool entries from a module.
 * Throws on duplicate tool names and validates definition shape at runtime.
 */
export function registerTools(entries: ToolEntry[], moduleName?: string): void {
  for (const entry of entries) {
    const def = entry.definition as { name?: unknown } | null | undefined;

    const name = typeof def?.name === "string" ? def.name : undefined;

    const hasModuleName = typeof moduleName === "string" && moduleName.trim().length > 0;

    // Runtime validation — catch misconfigurations early
    if (name === undefined || name.trim().length === 0) {
      throw new Error(
        `[Registry] Invalid tool definition${hasModuleName ? ` in module "${moduleName}"` : ""}: ` +
          `missing or invalid "name" field.`
      );
    }

    if (definitionMap.has(name)) {
      throw new Error(
        `[Registry] DUPLICATE tool "${name}"${hasModuleName ? ` in module "${moduleName}"` : ""}. ` +
          `Already registered. Each tool name must be unique.`
      );
    }
    definitionMap.set(name, entry.definition);
    handlerMap.set(name, entry.handler);
  }
}

/**
 * Get all tool definitions for MCP ListTools response.
 */
export function getAllDefinitions(): ToolEntryDefinition[] {
  return Array.from(definitionMap.values());
}

/**
 * Get a handler by tool name.
 * Returns undefined if tool not found.
 */
export function getHandler(name: string): ToolHandler | undefined {
  return handlerMap.get(name);
}

/**
 * Get total registered tool count.
 */
export function getToolCount(): number {
  return definitionMap.size;
}

/**
 * Get all registered tool names (for diagnostics).
 */
export function getRegisteredToolNames(): string[] {
  return Array.from(definitionMap.keys());
}

/**
 * Check if a tool is registered.
 */
export function hasTool(name: string): boolean {
  return definitionMap.has(name);
}

/**
 * Get registry statistics by category.
 */
export function getRegistryStats(): Record<string, number> {
  const stats: Record<string, number> = { total: definitionMap.size };

  for (const def of definitionMap.values()) {
    const category =
      (def as { metadata?: { category?: string } }).metadata?.category ?? "uncategorized";
    stats[category] = (stats[category] ?? 0) + 1;
  }

  return stats;
}

/**
 * Clear registry (for testing only).
 */
export function clearRegistry(): void {
  definitionMap.clear();
  handlerMap.clear();
}
