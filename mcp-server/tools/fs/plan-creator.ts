/**
 * Filesystem Tools - Plan Creator
 */

import { existsSync } from "fs";

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

export function createTechnicalPlan(
  plan: TechnicalPlan
): { success: boolean; summary: string } {
  // Plan validasyonu
  if (!plan.logicalChanges || plan.logicalChanges.length === 0) {
    return { success: false, summary: "Plan boş olamaz" };
  }
  
  // Özet oluştur
  const summaryLines: string[] = ["# Teknik Plan\n"];
  
  for (let i = 0; i < plan.logicalChanges.length; i++) {
    const change = plan.logicalChanges[i];
    if (!change) continue;
    summaryLines.push(`## ${i + 1}. ${change.summary}\n`);
    
    for (const file of change.filesToChange) {
      summaryLines.push(`- **${file.filePath}**: ${file.descriptionOfChange}`);
      if (file.clarifyingQuestionIfAny) {
        summaryLines.push(`  - ❓ ${file.clarifyingQuestionIfAny}`);
      }
    }
    summaryLines.push("");
  }
  
  return { success: true, summary: summaryLines.join("\n") };
}

// Tool Definition
export const CREATE_PLAN_TOOL = {
  name: "hev_fs_create_plan",
  description: "Teknik plan oluştur ve doğrula",
  inputSchema: { type: "object" as const, properties: { plan: { type: "string" } }, required: ["plan"] }
};
