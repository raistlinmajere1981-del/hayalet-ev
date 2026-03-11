// NOTE: Parses .rovo/_metadata/TOOL-LIST.md (auto-generated per MCP build) for OpenCode UI.

import { join } from "path";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
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
  errorKey?: string;
  errorParams?: { message: string };
}

interface QuickPromptRecord {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface OpencodeUiQuickPromptStoreResult {
  success: boolean;
  prompts: QuickPromptRecord[];
  path: string;
  error?: string;
  errorKey?: string;
  errorParams?: { message: string };
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

function getQuickPromptsPath(): string {
  return join(Paths.getDataDir(), "opencode-ui-quick-prompts.json");
}

function normalizeQuickPromptRecord(value: unknown): QuickPromptRecord | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record["id"] === "string" ? record["id"].trim() : "";
  const name = typeof record["name"] === "string" ? record["name"].trim() : "";
  const content = typeof record["content"] === "string" ? record["content"] : "";
  const createdAt = typeof record["createdAt"] === "number" ? record["createdAt"] : 0;

  if (id === "" || name === "" || content.trim() === "" || !Number.isFinite(createdAt)) {
    return null;
  }

  return { id, name, content, createdAt };
}

function normalizeQuickPromptRecords(value: unknown): QuickPromptRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeQuickPromptRecord(item))
    .filter((item): item is QuickPromptRecord => item !== null)
    .sort((left, right) => right.createdAt - left.createdAt);
}

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
      const message = (err as Error).message;
      return {
        success: false,
        total: 0,
        generatedAt: "",
        categories: [],
        toolNames: [],
        error: message,
        errorKey: "electron.ipc.errors.operationFailed",
        errorParams: { message },
      } satisfies HevToolListResult;
    }
  });

  registerHandler("opencode-ui-quick-prompts-read", async () => {
    const filePath = getQuickPromptsPath();

    try {
      const content = await readFile(filePath, "utf-8");
      const prompts = normalizeQuickPromptRecords(JSON.parse(content) as unknown);
      return {
        success: true,
        prompts,
        path: filePath,
      } satisfies OpencodeUiQuickPromptStoreResult;
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return {
          success: true,
          prompts: [],
          path: filePath,
        } satisfies OpencodeUiQuickPromptStoreResult;
      }

      return {
        success: false,
        prompts: [],
        path: filePath,
        error: error.message,
        errorKey: "electron.ipc.errors.operationFailed",
        errorParams: { message: error.message },
      } satisfies OpencodeUiQuickPromptStoreResult;
    }
  });

  registerHandler("opencode-ui-quick-prompts-write", async (promptsPayload: unknown) => {
    const filePath = getQuickPromptsPath();

    try {
      const prompts = normalizeQuickPromptRecords(promptsPayload);
      await mkdir(Paths.getDataDir(), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(prompts, null, 2)}\n`, "utf-8");
      return {
        success: true,
        prompts,
        path: filePath,
      } satisfies OpencodeUiQuickPromptStoreResult;
    } catch (err) {
      const message = (err as Error).message;
      return {
        success: false,
        prompts: [],
        path: filePath,
        error: message,
        errorKey: "electron.ipc.errors.operationFailed",
        errorParams: { message },
      } satisfies OpencodeUiQuickPromptStoreResult;
    }
  });
}
