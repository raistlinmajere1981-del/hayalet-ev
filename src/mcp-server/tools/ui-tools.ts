/**
 * UI Tools - Visual message rendering for MCP
 *
 * @module ui-tools
 * @category UI/Display
 * @description Provides formatted, visually appealing message boxes for better UX
 */

import { createMcpTranslatorSync, loadMcpLanguageSync } from "../utils/i18n/index.js";
import { logToolCall, logToolSuccess, logToolError } from "../utils/mcp-logger.js";

/**
 * Box drawing characters for different styles
 */
const BOX_CHARS = {
  double: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
    topJoin: "╦",
    bottomJoin: "╩",
    leftJoin: "╠",
    rightJoin: "╣",
    cross: "╬",
  },
  single: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
    topJoin: "┬",
    bottomJoin: "┴",
    leftJoin: "├",
    rightJoin: "┤",
    cross: "┼",
  },
};

/**
 * Message type configurations
 */
const MESSAGE_TYPES = {
  success: { icon: "✅", label: "SUCCESS" },
  error: { icon: "❌", label: "ERROR" },
  warning: { icon: "⚠️", label: "WARNING" },
  info: { icon: "ℹ️", label: "INFO" },
  question: { icon: "❓", label: "QUESTION" },
  progress: { icon: "🔄", label: "PROGRESS" },
  table: { icon: "📊", label: "TABLE" },
  menu: { icon: "📋", label: "MENU" },
  tree: { icon: "📁", label: "TREE" },
};

/**
 * Progress bar styles
 */
const PROGRESS_STYLES = {
  bar: { filled: "█", empty: "░" },
  blocks: { filled: "▓", empty: "░" },
  arrows: { filled: ">", empty: "-" },
  dots: { filled: "●", empty: "○" },
};

const uiToolDefinitionTranslator = createMcpTranslatorSync();

function messageBoxDefT(key: string, params?: Record<string, string | number | boolean>): string {
  return uiToolDefinitionTranslator(`mcpServer.uiTools.messageBox.definition.${key}`, params);
}

function messageBoxT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.uiTools.messageBox.runtime.${key}`, params);
}

function getUiLocale(): string {
  return loadMcpLanguageSync().locale;
}

export interface MessageBoxOptions {
  type?: keyof typeof MESSAGE_TYPES;
  title: string;
  message?: string;
  icon?: string;
  details?: string[];
  actions?: string[];
  width?: number;
  boxStyle?: "double" | "single";
  timestamp?: boolean;
  progress?: {
    current: number;
    total: number;
    percentage?: number;
    style?: keyof typeof PROGRESS_STYLES;
  };
  table?: {
    columns: string[];
    rows: string[][];
  };
  menu?: {
    options: Array<{ key: string; label: string; icon?: string }>;
    defaultSelected?: number;
  };
  tree?: Record<string, unknown>;
}

/**
 * Get terminal width (fallback to 80 if not available)
 */
function getTerminalWidth(): number {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return process.stdout.columns ?? 80;
}

/**
 * Wrap text to fit within specified width
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).length <= width) {
      currentLine += (currentLine !== "" ? " " : "") + word;
    } else {
      if (currentLine !== "") lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine !== "") lines.push(currentLine);

  return lines;
}

/**
 * Render progress bar
 */
function renderProgressBar(
  progress: NonNullable<MessageBoxOptions["progress"]>,
  width: number
): string {
  const style = PROGRESS_STYLES[progress.style ?? "bar"];
  const percentage = progress.percentage ?? Math.round((progress.current / progress.total) * 100);
  const barWidth = width - 20; // Reserve space for percentage and count
  const filledWidth = Math.round((barWidth * percentage) / 100);
  const emptyWidth = barWidth - filledWidth;

  const bar = style.filled.repeat(filledWidth) + style.empty.repeat(emptyWidth);
  const label = `${percentage}% (${progress.current}/${progress.total})`;

  return `[${bar}] ${label}`;
}

/**
 * Render table
 */
function renderTable(
  table: NonNullable<MessageBoxOptions["table"]>,
  width: number,
  boxStyle: "double" | "single"
): string[] {
  const lines: string[] = [];
  const chars = BOX_CHARS[boxStyle];
  const { columns, rows } = table;

  // Calculate column widths
  const colCount = columns.length;
  const colWidth = Math.floor((width - colCount - 1) / colCount);

  // Render header
  const headerRow = columns.map((col) => col.padEnd(colWidth).substring(0, colWidth)).join(" │ ");
  lines.push("  " + headerRow);

  // Render separator
  const separator = columns.map(() => chars.horizontal.repeat(colWidth)).join("─┼─");
  lines.push("  " + separator);

  // Render rows
  for (const row of rows) {
    const rowText = row.map((cell) => cell.padEnd(colWidth).substring(0, colWidth)).join(" │ ");
    lines.push("  " + rowText);
  }

  return lines;
}

/**
 * Render menu
 */
function renderMenu(menu: NonNullable<MessageBoxOptions["menu"]>, _width: number): string[] {
  const lines: string[] = [];
  const { options, defaultSelected } = menu;

  options.forEach((option, index) => {
    const isSelected = defaultSelected !== undefined && index === defaultSelected;
    const icon = option.icon != null && option.icon !== "" ? `${option.icon} ` : "";
    const marker = isSelected ? ` ${messageBoxT("selectedMarker")}` : "";
    const line = `  [${option.key}] ${icon}${option.label}${marker}`;
    lines.push(line);
  });

  return lines;
}

/**
 * Render tree structure
 */
function renderTree(
  tree: Record<string, unknown>,
  prefix = "",
  _isLast = true,
  lines: string[] = []
): string[] {
  const entries = Object.entries(tree);

  entries.forEach(([key, value], index) => {
    const isLastEntry = index === entries.length - 1;
    const connector = isLastEntry ? "└─" : "├─";
    const line = prefix + connector + " " + key;

    if (typeof value === "string") {
      lines.push("  " + line + "  " + value);
    } else {
      lines.push("  " + line);
      const newPrefix = prefix + (isLastEntry ? "   " : "│  ");
      if (value !== null && value !== undefined && typeof value === "object") {
        renderTree(value as Record<string, unknown>, newPrefix, isLastEntry, lines);
      }
    }
  });

  return lines;
}

/**
 * Render message box
 */
export function renderMessageBox(options: MessageBoxOptions): string {
  const {
    type = "info",
    title,
    message,
    icon,
    details,
    actions,
    width = Math.min(getTerminalWidth() - 4, 80),
    boxStyle = "double",
    timestamp = false,
    progress,
    table,
    menu,
    tree,
  } = options;

  const chars = BOX_CHARS[boxStyle];
  const typeConfig = MESSAGE_TYPES[type];
  const displayIcon = icon ?? typeConfig.icon;
  const lines: string[] = [];

  // Calculate content width (excluding borders)
  const contentWidth = width - 4; // 2 for borders + 2 for padding

  // Top border
  lines.push(chars.topLeft + chars.horizontal.repeat(width - 2) + chars.topRight);

  // Title line with icon
  let titleText = `${displayIcon}  ${title.toUpperCase()}`;
  if (timestamp) {
    const time = new Date().toLocaleTimeString(getUiLocale());
    const spacing = " ".repeat(Math.max(0, contentWidth - titleText.length - time.length - 4));
    titleText = `  ${titleText}${spacing}[${time}]  `;
  } else {
    titleText = "  " + titleText.padEnd(contentWidth) + "  ";
  }
  lines.push(chars.vertical + titleText + chars.vertical);

  // Middle separator
  lines.push(chars.leftJoin + chars.horizontal.repeat(width - 2) + chars.rightJoin);

  // Message content
  if (message != null && message !== "") {
    const wrappedLines = wrapText(message, contentWidth - 2);
    wrappedLines.forEach((line) => {
      lines.push(chars.vertical + "  " + line.padEnd(contentWidth) + "  " + chars.vertical);
    });
    lines.push(chars.vertical + "  ".repeat(width / 2) + chars.vertical);
  }

  // Progress bar
  if (progress) {
    const progressBar = renderProgressBar(progress, contentWidth);
    lines.push(chars.vertical + "  " + progressBar.padEnd(contentWidth) + "  " + chars.vertical);
    lines.push(chars.vertical + "  ".repeat(width / 2) + chars.vertical);
  }

  // Table
  if (table) {
    const tableLines = renderTable(table, contentWidth, boxStyle);
    tableLines.forEach((line) => {
      lines.push(chars.vertical + line.padEnd(width - 2) + chars.vertical);
    });
    lines.push(chars.vertical + "  ".repeat(width / 2) + chars.vertical);
  }

  // Menu
  if (menu) {
    const menuLines = renderMenu(menu, contentWidth);
    menuLines.forEach((line) => {
      lines.push(chars.vertical + line.padEnd(width - 2) + chars.vertical);
    });
    lines.push(chars.vertical + "  ".repeat(width / 2) + chars.vertical);
  }

  // Tree
  if (tree) {
    const treeLines = renderTree(tree);
    treeLines.forEach((line) => {
      lines.push(chars.vertical + line.padEnd(width - 2) + chars.vertical);
    });
    lines.push(chars.vertical + "  ".repeat(width / 2) + chars.vertical);
  }

  // Details
  if (details && details.length > 0) {
    lines.push(
      chars.vertical +
        ("  " + messageBoxT("detailsTitle")).padEnd(width - 2) +
        chars.vertical
    );
    details.forEach((detail) => {
      const wrappedDetails = wrapText(detail, contentWidth - 4);
      wrappedDetails.forEach((line) => {
        lines.push(
          chars.vertical + "    • " + line.padEnd(contentWidth - 2) + "  " + chars.vertical
        );
      });
    });
    lines.push(chars.vertical + "  ".repeat(width / 2) + chars.vertical);
  }

  // Actions
  if (actions && actions.length > 0) {
    lines.push(chars.leftJoin + chars.horizontal.repeat(width - 2) + chars.rightJoin);
    const actionsText = actions.map((action) => `[${action}]`).join("  ");
    lines.push(chars.vertical + "  " + actionsText.padEnd(contentWidth) + "  " + chars.vertical);
  }

  // Bottom border
  lines.push(chars.bottomLeft + chars.horizontal.repeat(width - 2) + chars.bottomRight);

  return lines.join("\n");
}

/**
 * MCP Tool: Display formatted message box
 */
const hevMessageBox = {
  name: "hev_message_box",
  description: messageBoxDefT("description"),
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
        description: messageBoxDefT("type"),
        default: "info",
      },
      title: {
        type: "string",
        description: messageBoxDefT("title"),
      },
      message: {
        type: "string",
        description: messageBoxDefT("message"),
      },
      icon: {
        type: "string",
        description: messageBoxDefT("icon"),
      },
      details: {
        type: "array",
        items: { type: "string" },
        description: messageBoxDefT("details"),
      },
      actions: {
        type: "array",
        items: { type: "string" },
        description: messageBoxDefT("actions"),
      },
      width: {
        type: "number",
        description: messageBoxDefT("width"),
      },
      boxStyle: {
        type: "string",
        enum: ["double", "single"],
        description: messageBoxDefT("boxStyle"),
        default: "double",
      },
      timestamp: {
        type: "boolean",
        description: messageBoxDefT("timestamp"),
        default: false,
      },
      progress: {
        type: "object",
        properties: {
          current: { type: "number", description: messageBoxDefT("progress.current") },
          total: { type: "number", description: messageBoxDefT("progress.total") },
          percentage: {
            type: "number",
            description: messageBoxDefT("progress.percentage"),
          },
          style: {
            type: "string",
            enum: ["bar", "blocks", "arrows", "dots"],
            description: messageBoxDefT("progress.style"),
            default: "bar",
          },
        },
        required: ["current", "total"],
        description: messageBoxDefT("progress.description"),
      },
      table: {
        type: "object",
        properties: {
          columns: {
            type: "array",
            items: { type: "string" },
            description: messageBoxDefT("table.columns"),
          },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
            description: messageBoxDefT("table.rows"),
          },
        },
        required: ["columns", "rows"],
        description: messageBoxDefT("table.description"),
      },
      menu: {
        type: "object",
        properties: {
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string", description: messageBoxDefT("menu.optionKey") },
                label: { type: "string", description: messageBoxDefT("menu.optionLabel") },
                icon: { type: "string", description: messageBoxDefT("menu.optionIcon") },
              },
              required: ["key", "label"],
            },
            description: messageBoxDefT("menu.options"),
          },
          defaultSelected: {
            type: "number",
            description: messageBoxDefT("menu.defaultSelected"),
          },
        },
        required: ["options"],
        description: messageBoxDefT("menu.description"),
      },
      tree: {
        type: "object",
        description: messageBoxDefT("tree"),
      },
    },
    required: ["title"],
  },

  handler: (args: MessageBoxOptions): unknown => {
    const { startTime } = logToolCall("hev_message_box", args);

    try {
      const output = renderMessageBox(args);

      logToolSuccess("hev_message_box", { displayed: true }, Date.now() - startTime);

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error) {
      logToolError("hev_message_box", error as Error, args, startTime);
      throw error;
    }
  },
};

// Export for ui-tools module
export { hevMessageBox as hev_message_box };
export const UI_TOOL_DEFINITIONS = [hevMessageBox];
