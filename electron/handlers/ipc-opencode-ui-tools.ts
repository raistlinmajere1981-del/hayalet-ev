// NOTE: Parses .rovo/_metadata/TOOL-LIST.md (auto-generated per MCP build) for OpenCode UI.

import { join } from "path";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { registerHandler } from "./ipc-helpers.ts";
import { Paths } from "../paths.ts";
import type { OpencodeUiSharedState } from "../../shared/opencode-ui-state.js";
import {
  DEFAULT_OPENCODE_UI_SHARED_STATE,
  normalizeOpencodeUiQuickPromptRecords,
  normalizeOpencodeUiSharedState,
} from "../../shared/opencode-ui-state.js";

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

interface OpencodeUiSharedStateResult {
  success: boolean;
  state: OpencodeUiSharedState;
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

function getSharedStateDirPath(): string {
  return join(Paths.getDataDir(), "shared");
}

function getSharedStatePath(): string {
  return join(getSharedStateDirPath(), "opencode-ui-state.json");
}

function normalizeQuickPromptRecords(value: unknown): QuickPromptRecord[] {
  return normalizeOpencodeUiQuickPromptRecords(value);
}

async function readLegacyQuickPrompts(): Promise<QuickPromptRecord[]> {
  const filePath = getQuickPromptsPath();

  try {
    const content = await readFile(filePath, "utf-8");
    return normalizeQuickPromptRecords(JSON.parse(content) as unknown);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return [];
    }

    throw err;
  }
}

function cloneDefaultSharedState(): OpencodeUiSharedState {
  return normalizeOpencodeUiSharedState(DEFAULT_OPENCODE_UI_SHARED_STATE);
}

async function readSharedStateFile(): Promise<OpencodeUiSharedState> {
  const filePath = getSharedStatePath();

  try {
    const content = await readFile(filePath, "utf-8");
    return normalizeOpencodeUiSharedState(JSON.parse(content) as unknown);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== "ENOENT") {
      throw err;
    }
  }

  const legacyQuickPrompts = await readLegacyQuickPrompts();
  return normalizeOpencodeUiSharedState({
    ...cloneDefaultSharedState(),
    ...(legacyQuickPrompts.length > 0 ? { quickPrompts: legacyQuickPrompts } : {}),
  });
}

async function writeSharedStateFile(state: unknown): Promise<OpencodeUiSharedState> {
  const filePath = getSharedStatePath();
  const normalized = normalizeOpencodeUiSharedState(state);
  await mkdir(getSharedStateDirPath(), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
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
    const filePath = getSharedStatePath();

    try {
      const state = await readSharedStateFile();
      return {
        success: true,
        prompts: state.quickPrompts,
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
    const filePath = getSharedStatePath();

    try {
      const prompts = normalizeQuickPromptRecords(promptsPayload);
      const current = await readSharedStateFile();
      await writeSharedStateFile({
        ...current,
        quickPrompts: prompts,
      });
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

  registerHandler("opencode-ui-shared-state-read", async () => {
    const filePath = getSharedStatePath();

    try {
      const state = await readSharedStateFile();
      return {
        success: true,
        state,
        path: filePath,
      } satisfies OpencodeUiSharedStateResult;
    } catch (err) {
      const message = (err as Error).message;
      return {
        success: false,
        state: cloneDefaultSharedState(),
        path: filePath,
        error: message,
        errorKey: "electron.ipc.errors.operationFailed",
        errorParams: { message },
      } satisfies OpencodeUiSharedStateResult;
    }
  });

  registerHandler("opencode-ui-shared-state-write", async (payload: unknown) => {
    const filePath = getSharedStatePath();

    try {
      const state = await writeSharedStateFile(payload);
      return {
        success: true,
        state,
        path: filePath,
      } satisfies OpencodeUiSharedStateResult;
    } catch (err) {
      const message = (err as Error).message;
      return {
        success: false,
        state: cloneDefaultSharedState(),
        path: filePath,
        error: message,
        errorKey: "electron.ipc.errors.operationFailed",
        errorParams: { message },
      } satisfies OpencodeUiSharedStateResult;
    }
  });
}
