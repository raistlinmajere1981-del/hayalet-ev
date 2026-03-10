import {
  gitForkSetup,
  gitCreatePr,
  gitCheckGuidelines,
  gitPrStatus,
} from "../../tools/git-tools.js";
import { GIT_TOOL_DEFINITIONS } from "../../tools/git-tools.js";
import type { ToolEntry } from "../registry.js";

export function createGitTools(): ToolEntry[] {
  return [
    {
      definition: GIT_TOOL_DEFINITIONS[0],
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const result = await gitForkSetup(
          a["repo"] as string,
          a["work_dir"] as string,
          a["base_branch"] as string,
          a["feature_branch"] as string,
          a["shallow"] as boolean
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: GIT_TOOL_DEFINITIONS[1],
      handler: async (args): Promise<unknown> => {
        const a = args as Record<string, unknown>;
        const result = await gitCreatePr(
          a["base_branch"] as string,
          a["title"] as string,
          a["body"] as string,
          a["cwd"] as string
        );
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: GIT_TOOL_DEFINITIONS[2],
      handler: async (args): Promise<unknown> => {
        const result = await gitCheckGuidelines((args as { cwd?: string }).cwd);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: GIT_TOOL_DEFINITIONS[3],
      handler: async (args): Promise<unknown> => {
        const result = await gitPrStatus((args as { cwd?: string }).cwd);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
  ];
}
