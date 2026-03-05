/**
 * Git Tool Handlers
 * Fork setup, PR creation, contribution guidelines check
 *
 * Co-located: definition + handler in ToolEntry format
 */

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
      definition: GIT_TOOL_DEFINITIONS[0], // hev_git_fork_setup
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
      definition: GIT_TOOL_DEFINITIONS[1], // hev_git_create_pr
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
      definition: GIT_TOOL_DEFINITIONS[2], // hev_git_check_guidelines
      handler: async (args): Promise<unknown> => {
        const result = await gitCheckGuidelines((args as { cwd?: string }).cwd);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
    {
      definition: GIT_TOOL_DEFINITIONS[3], // hev_git_pr_status
      handler: async (args): Promise<unknown> => {
        const result = await gitPrStatus((args as { cwd?: string }).cwd);
        return { content: [{ type: "text", text: result.message }] };
      },
    },
  ];
}
