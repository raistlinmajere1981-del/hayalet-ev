/**
 * UI Tool Handlers
 * Message box display with various styles
 *
 * Co-located: definition + handler in ToolEntry format
 */

import { renderMessageBox } from "../../tools/ui-tools.js";
import type { ToolEntry } from "../registry.js";

export function createUiTools(): ToolEntry[] {
  return [
    {
      definition: {
        name: "hev_message_box",
        description:
          "Display a formatted, visually appealing message box with various types (success, error, warning, info, question, progress, table, menu, tree). Provides consistent UX and token efficiency compared to manual echo formatting.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "success",
                "error",
                "warning",
                "info",
                "question",
                "progress",
                "table",
                "menu",
                "tree",
              ],
              description: "Message box type (determines icon and styling)",
              default: "info",
            },
            title: {
              type: "string",
              description: "Message box title (will be uppercased)",
            },
            message: {
              type: "string",
              description: "Main message content (supports text wrapping)",
            },
            icon: {
              type: "string",
              description: "Custom icon (overrides default type icon)",
            },
            details: {
              type: "array",
              items: { type: "string" },
              description: "Additional details as bullet points",
            },
            actions: {
              type: "array",
              items: { type: "string" },
              description: "Action buttons to display at bottom",
            },
            width: {
              type: "number",
              description: "Box width in characters (default: auto-detect terminal width, max 80)",
            },
            boxStyle: {
              type: "string",
              enum: ["double", "single"],
              description: "Box drawing style",
              default: "double",
            },
            timestamp: {
              type: "boolean",
              description: "Show timestamp in title bar",
              default: false,
            },
            progress: {
              type: "object",
              properties: {
                current: { type: "number", description: "Current progress value" },
                total: { type: "number", description: "Total progress value" },
                percentage: {
                  type: "number",
                  description: "Manual percentage (auto-calculated if not provided)",
                },
                style: {
                  type: "string",
                  enum: ["bar", "blocks", "arrows", "dots"],
                  description: "Progress bar style",
                  default: "bar",
                },
              },
              required: ["current", "total"],
              description: "Progress bar configuration (for type=progress)",
            },
            table: {
              type: "object",
              properties: {
                columns: {
                  type: "array",
                  items: { type: "string" },
                  description: "Column headers",
                },
                rows: {
                  type: "array",
                  items: { type: "array", items: { type: "string" } },
                  description: "Table rows",
                },
              },
              required: ["columns", "rows"],
              description: "Table data (for type=table)",
            },
            menu: {
              type: "object",
              properties: {
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string", description: "Option key/shortcut" },
                      label: { type: "string", description: "Option label" },
                      icon: { type: "string", description: "Option icon (optional)" },
                    },
                    required: ["key", "label"],
                  },
                  description: "Menu options",
                },
                defaultSelected: {
                  type: "number",
                  description: "Default selected option index",
                },
              },
              required: ["options"],
              description: "Interactive menu configuration (for type=menu)",
            },
            tree: {
              type: "object",
              description:
                'Tree structure as nested object (for type=tree). Example: {"src/": {"file.ts": "✏️ modified"}}',
            },
          },
          required: ["title"],
        },
        metadata: {
          category: "ui",
          subcategory: "display",
          priority: "high",
          complexity: "simple",
          useCases: [
            "Display success/error messages with visual appeal",
            "Show progress bars for long operations",
            "Render tables for structured data",
            "Display interactive menus for user choices",
            "Show file tree structures",
            "Replace manual echo formatting (70-80% token savings)",
          ],
          relatedTools: ["hev_mcp_health", "hev_dev_analyze_project"],
          agentGuidance:
            "Use instead of manual echo/console.log formatting. Provides consistent UX, automatic wrapping, icons, and visual appeal. Saves 70-80% tokens compared to manual formatting.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["ui", "display", "message", "formatting", "visual", "ux"],
        },
      },
      handler: (args): unknown => {
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          typeof value === "object" && value !== null;
        const opts = isRecord(args) ? args : {};
        const progress = isRecord(opts["progress"]) ? opts["progress"] : undefined;
        const table = isRecord(opts["table"]) ? opts["table"] : undefined;
        const menu = isRecord(opts["menu"]) ? opts["menu"] : undefined;
        const result = renderMessageBox({
          ...((opts["type"] as
            | "info"
            | "error"
            | "success"
            | "progress"
            | "warning"
            | "tree"
            | "question"
            | "table"
            | "menu"
            | undefined) !== undefined
            ? {
                type: opts["type"] as
                  | "info"
                  | "error"
                  | "success"
                  | "progress"
                  | "warning"
                  | "tree"
                  | "question"
                  | "table"
                  | "menu",
              }
            : {}),
          title: (opts["title"] ?? opts["message"]) as string,
          message: opts["message"] as string,
          ...((opts["icon"] as string | undefined) !== undefined
            ? { icon: opts["icon"] as string }
            : {}),
          ...(Array.isArray(opts["details"])
            ? { details: opts["details"] as string[] }
            : typeof opts["details"] === "string"
              ? { details: opts["details"].split("\n") }
              : {}),
          ...(Array.isArray(opts["actions"])
            ? { actions: opts["actions"] as string[] }
            : typeof opts["actions"] === "string"
              ? { actions: opts["actions"].split(",") }
              : {}),
          ...((opts["width"] as number | undefined) !== undefined
            ? { width: opts["width"] as number }
            : {}),
          ...((opts["boxStyle"] as "double" | "single" | undefined) !== undefined
            ? { boxStyle: opts["boxStyle"] as "double" | "single" }
            : {}),
          ...((opts["timestamp"] as boolean | undefined) !== undefined
            ? { timestamp: opts["timestamp"] as boolean }
            : {}),
          ...(progress
            ? {
                progress: {
                  current: progress["current"] as number,
                  total: progress["total"] as number,
                  ...((progress["percentage"] as number | undefined) !== undefined
                    ? { percentage: progress["percentage"] as number }
                    : {}),
                  ...((progress["style"] as "bar" | "blocks" | "arrows" | "dots" | undefined) !==
                  undefined
                    ? { style: progress["style"] as "bar" | "blocks" | "arrows" | "dots" }
                    : {}),
                },
              }
            : {}),
          ...(table
            ? {
                table: {
                  columns: table["columns"] as string[],
                  rows: table["rows"] as string[][],
                },
              }
            : {}),
          ...(menu
            ? {
                menu: {
                  options: (Array.isArray(menu["options"]) ? (menu["options"] as unknown[]) : [])
                    .filter(isRecord)
                    .map((opt) => ({
                      key: opt["key"] as string,
                      label: opt["label"] as string,
                      ...((opt["icon"] as string | undefined) !== undefined
                        ? { icon: opt["icon"] as string }
                        : {}),
                    })),
                  ...((menu["defaultSelected"] as number | undefined) !== undefined
                    ? { defaultSelected: menu["defaultSelected"] as number }
                    : {}),
                },
              }
            : {}),

          ...((opts["tree"] as Record<string, unknown> | undefined) !== undefined
            ? { tree: opts["tree"] as Record<string, unknown> }
            : {}),
        });
        return { content: [{ type: "text", text: result }] };
      },
    },
  ];
}
