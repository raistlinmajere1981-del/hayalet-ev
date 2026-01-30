/**
 * Handler Registry - Type-safe tool handler registration
 * Replaces massive if-chain with Map-based lookup
 */

import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";

// Handler function type
export type ToolHandler = (args?: Record<string, unknown>) => Promise<unknown> | unknown;

// Registry storage
const handlerRegistry = new Map<string, ToolHandler>();

/**
 * Register a tool handler
 */
export function registerHandler(toolName: string, handler: ToolHandler): void {
  if (handlerRegistry.has(toolName)) {
    console.warn(`[Handler Registry] Tool "${toolName}" already registered. Overwriting.`);
  }
  handlerRegistry.set(toolName, handler);
}

/**
 * Register multiple handlers at once
 */
export function registerHandlers(handlers: Record<string, ToolHandler>): void {
  for (const [toolName, handler] of Object.entries(handlers)) {
    registerHandler(toolName, handler);
  }
}

/**
 * Execute a tool handler
 */
export async function executeHandler(
  request: CallToolRequest
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { name, arguments: args } = request.params;

  const handler = handlerRegistry.get(name);
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await handler(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Tool execution failed: ${errorMessage}`);
  }
}

/**
 * Get all registered tool names
 */
export function getRegisteredTools(): string[] {
  return Array.from(handlerRegistry.keys());
}

/**
 * Clear all handlers (useful for testing)
 */
export function clearHandlers(): void {
  handlerRegistry.clear();
}
