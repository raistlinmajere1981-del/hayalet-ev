/**
 * IPC Handler — Hayalet-ev MCP Tool List
 *
 * Parses `.rovo/_metadata/TOOL-LIST.md` (auto-generated on each MCP build)
 * and returns structured tool data for the OpenCode UI.
 */

import { join } from "path";
import { readFile, stat } from "fs/promises";
import { registerHandler } from "./ipc-helpers.ts";
import { Paths } from "../paths.ts";

export interface HevToolCategory {
  name: string;
  count: number;
  tools: Array<{ name: string; description: string }>;
}

export interface HevToolListResult {
  success: boolean;
  total: number;
  generatedAt: string;
  categories: HevToolCategory[];
  toolNames: string[];
  error?: string;
}

const CATEGORY_HEADER_RE = /^## (.+?) \((\d+) tools?\)$/;
const TOOL_ROW_RE = /^\| `([^`]+)` \| (.+?) \|$/;
const TOTAL_RE = /^> \*\*Total Tools:\*\* (\d+)$/;
const GENERATED_RE = /^> \*\*Generated:\*\* (.+)$/;

function parseToolListMd(content: string): Omit<HevToolListResult, "success"> {
  const lines = content.split("\n");
  let total = 0;
  let generatedAt = "";
  const categories: HevToolCategory[] = [];
  const toolNames: string[] = [];
  let currentCategory: HevToolCategory | null = null;
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const totalMatch = TOTAL_RE.exec(trimmed);
    if (totalMatch?.[1] !== undefined) {
      total = parseInt(totalMatch[1], 10);
      continue;
    }

    const genMatch = GENERATED_RE.exec(trimmed);
    if (genMatch?.[1] !== undefined) {
      generatedAt = genMatch[1];
      continue;
    }

    const catMatch = CATEGORY_HEADER_RE.exec(trimmed);
    if (catMatch?.[1] !== undefined && catMatch[2] !== undefined) {
      currentCategory = {
        name: catMatch[1],
        count: parseInt(catMatch[2], 10),
        tools: [],
      };
      categories.push(currentCategory);
      inTable = false;
      continue;
    }

    if (trimmed.startsWith("| Tool") || trimmed.startsWith("|---")) {
      inTable = true;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      inTable = false;
      continue;
    }

    if (inTable && currentCategory !== null) {
      const toolMatch = TOOL_ROW_RE.exec(trimmed);
      if (toolMatch?.[1] !== undefined && toolMatch[2] !== undefined) {
        const toolName = toolMatch[1];
        currentCategory.tools.push({
          name: toolName,
          description: toolMatch[2].trim(),
        });
        toolNames.push(toolName);
      }
    }
  }

  return { total, generatedAt, categories, toolNames };
}

let cachedResult: HevToolListResult | null = null;
let cachedMtime = 0;

export function setupOpencodeUiToolsHandlers(): void {
  registerHandler("opencode-ui-hev-tools", async () => {
    try {
      const filePath = join(Paths.getProjectRoot(), ".rovo", "_metadata", "TOOL-LIST.md");
      const { mtimeMs } = await stat(filePath);

      if (cachedResult !== null && mtimeMs === cachedMtime) {
        return cachedResult;
      }

      const content = await readFile(filePath, "utf-8");
      const parsed = parseToolListMd(content);

      cachedResult = { success: true, ...parsed };
      cachedMtime = mtimeMs;
      return cachedResult;
    } catch (err) {
      return {
        success: false,
        total: 0,
        generatedAt: "",
        categories: [],
        toolNames: [],
        error: (err as Error).message,
      } satisfies HevToolListResult;
    }
  });
}
