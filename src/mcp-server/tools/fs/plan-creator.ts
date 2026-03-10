/**
 * Filesystem Tools - Plan Creator
 */

import { createMcpTranslatorSync } from "../../utils/i18n/index.js";

interface TechnicalPlan {
  logicalChanges?: Array<{
    summary: string;
    filesToChange: Array<{
      filePath: string;
      descriptionOfChange: string;
      clarifyingQuestionIfAny?: string;
    }>;
  }>;
}

const planTranslator = createMcpTranslatorSync();

function planT(key: string, params?: Record<string, string | number | boolean>): string {
  return planTranslator(`mcpServer.fs.plan.${key}`, params);
}

function planToolDefinitionT(key: string): string {
  return planTranslator(`mcpServer.fs.toolDefinitions.${key}`);
}

export function createTechnicalPlan(plan: TechnicalPlan): { success: boolean; summary: string } {
  if (!plan.logicalChanges || plan.logicalChanges.length === 0) {
    return { success: false, summary: planT("empty") };
  }

  const summaryLines: string[] = [planT("title"), ""];

  for (let i = 0; i < plan.logicalChanges.length; i++) {
    const change = plan.logicalChanges[i];
    if (!change) continue;
    summaryLines.push(planT("sectionTitle", { index: i + 1, summary: change.summary }));
    summaryLines.push("");

    for (const file of change.filesToChange) {
      summaryLines.push(
        planT("fileLine", { filePath: file.filePath, description: file.descriptionOfChange })
      );
      if (file.clarifyingQuestionIfAny !== undefined && file.clarifyingQuestionIfAny.length > 0) {
        summaryLines.push(planT("questionLine", { question: file.clarifyingQuestionIfAny }));
      }
    }
    summaryLines.push("");
  }

  return { success: true, summary: summaryLines.join("\n") };
}

export const CREATE_PLAN_TOOL = {
  name: "hev_fs_create_plan",
  description: planToolDefinitionT("createPlan.description"),
  inputSchema: {
    type: "object" as const,
    properties: { plan: { type: "string", description: planToolDefinitionT("createPlan.plan") } },
    required: ["plan"],
  },
  metadata: {
    category: "filesystem",
    subcategory: "planning",
  },
};
