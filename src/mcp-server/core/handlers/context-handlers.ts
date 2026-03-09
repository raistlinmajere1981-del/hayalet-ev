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
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import type { ToolEntry, ToolContext } from "../registry.js";

export function createContextTools(context: ToolContext): ToolEntry[] {
  const { PROJECT_ROOT } = context;

  const contextHandlerT = (key: string, params?: Record<string, string | number | boolean>) =>
    createMcpTranslatorSync()(`mcpServer.contextTools.handler.${key}`, params);

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
        const lines = [
          contextHandlerT("statusTitle"),
          "",
          contextHandlerT("available", {
            value:
              result.available.length > 0
                ? result.available.join(", ")
                : contextHandlerT("none"),
          }),
          contextHandlerT("repomix", { value: result.repomixVersion }),
        ];

        if (result.lastGenerated !== undefined) {
          lines.push(contextHandlerT("lastGenerated", { value: result.lastGenerated }));
        }

        const currentLevels = Object.entries(result.current).filter(([, value]) => value !== null);
        if (currentLevels.length > 0) {
          lines.push("", contextHandlerT("levelsTitle"));
          for (const [level, value] of currentLevels) {
            if (!value) continue;
            lines.push(
              contextHandlerT("levelLine", {
                level,
                sizeKB: value.sizeKB,
                age: value.age,
                tokens: value.tokens,
              })
            );
          }
        }

        const output = lines.join("\n");
        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: CONTEXT_TOOL_DEFINITIONS[2], // hev_context_module
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const includeTests =
          typeof a["include_tests"] === "boolean"
            ? a["include_tests"]
            : typeof a["includeTests"] === "boolean"
              ? a["includeTests"]
              : undefined;
        const result = await moduleContext(PROJECT_ROOT, {
          module: a["module"] as string,
          ...(includeTests !== undefined ? { includeTests } : {}),
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
