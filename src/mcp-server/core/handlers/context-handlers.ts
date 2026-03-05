/**
 * Context Tool Handlers
 * Project context generation (Repomix integration)
 *
 * Co-located: definition + handler in ToolEntry format
 */

import {
  generateContext,
  contextStatus,
  moduleContext,
  readContext,
  CONTEXT_TOOL_DEFINITIONS,
} from "../../tools/context-tools.js";
import type { ToolEntry, ToolContext } from "../registry.js";

export function createContextTools(context: ToolContext): ToolEntry[] {
  const { PROJECT_ROOT } = context;

  return [
    {
      definition: CONTEXT_TOOL_DEFINITIONS[0], // hev_context_generate
      handler: async (args): Promise<unknown> => {
        const result = await generateContext(PROJECT_ROOT, args as Record<string, unknown>);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: CONTEXT_TOOL_DEFINITIONS[1], // hev_context_status
      handler: (): unknown => {
        const result = contextStatus(PROJECT_ROOT);
        const output = `📊 Context Status\n\nAvailable: ${result.available.join(", ")}\nRepomix: ${result.repomixVersion}`;
        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: CONTEXT_TOOL_DEFINITIONS[2], // hev_context_module
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const result = await moduleContext(PROJECT_ROOT, {
          module: a["module"] as string,
          ...((a["includeTests"] as boolean | undefined) !== undefined
            ? { includeTests: a["includeTests"] as boolean }
            : {}),
        });
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: CONTEXT_TOOL_DEFINITIONS[3], // hev_context_read
      handler: (args): unknown => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const level = (args?.["level"] as string) ?? "L2";
        const result = readContext(PROJECT_ROOT, level as "L1" | "L2" | "L3" | "L4");
        return { content: [{ type: "text", text: result.content }] };
      },
    },
  ];
}
