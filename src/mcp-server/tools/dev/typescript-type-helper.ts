/**
 * Development Tools - TypeScript Type Inference Helper
 *
 * Type uyumsuzluklarını analiz edip çözüm önerir.
 * TS Language Service API-backed: Gerçek semantic analiz, anında sonuç.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { logToolError } from "../../utils/mcp-logger.js";
import { getTsLanguageService } from "../../utils/ts-language-service.js";
import type { DiagnosticResult } from "../../utils/ts-language-service.js";

interface TypeHelperOptions {
  file_path: string;
  show_interfaces?: boolean;
  suggest_fixes?: boolean;
  analyze_conflicts?: boolean;
}

interface TypeConflict {
  error_code: number;
  line: number;
  column: number;
  expected_type: string;
  actual_type: string;
  missing_fields?: string[];
  extra_fields?: string[];
  suggestion?: string;
  raw_message: string;
}

interface TypeHelperResult {
  success: boolean;
  output: string;
  conflicts: TypeConflict[];
  interface_definitions?: Record<string, string>;
}

export function analyzeTypeConflicts(
  options: TypeHelperOptions,
  projectRoot: string
): TypeHelperResult {
  const {
    file_path: filePath,
    show_interfaces: showInterfaces = true,
    suggest_fixes: suggestFixes = true,
  } = options;

  const fullPath = projectRoot !== "" ? join(projectRoot, filePath) : filePath;

  try {
    // TS Language Service ile diagnostics al (anında, tsc çalıştırmadan)
    const mgr = getTsLanguageService(projectRoot);
    const allDiagnostics = mgr.getDiagnostics(filePath);

    // Type mismatch hatalarını filtrele
    const typeMismatchCodes = [2345, 2322, 2339, 2741, 2304, 2305];
    const typeMismatchErrors = allDiagnostics.filter(
      (d) => d.category === "error" && typeMismatchCodes.includes(d.code)
    );

    if (typeMismatchErrors.length === 0) {
      const otherErrors = allDiagnostics.filter(
        (d) => d.category === "error" && !typeMismatchCodes.includes(d.code)
      );

      let message = "✅ No type mismatch conflicts found.\n";

      if (otherErrors.length > 0) {
        message += `\n⚠️  However, ${otherErrors.length} other TypeScript errors found:\n`;
        otherErrors.slice(0, 10).forEach((err) => {
          const truncatedMsg =
            err.message.length > 80 ? err.message.slice(0, 80) + "..." : err.message;
          message += `  Line ${err.line}: ${err.code} - ${truncatedMsg}\n`;
        });
        if (otherErrors.length > 10) {
          message += `  ... and ${otherErrors.length - 10} more errors\n`;
        }
        message += "\n📊 Use hev_dev_typescript_dashboard for full overview.";
      } else if (allDiagnostics.filter((d) => d.category === "error").length === 0) {
        message += "\n✨ No TypeScript errors found in this file!";
      }

      return {
        success: true,
        output: message,
        conflicts: [],
      };
    }

    // Her conflict'i analiz et
    const conflicts: TypeConflict[] = [];
    for (const error of typeMismatchErrors) {
      const conflict = analyzeDiagnostic(error);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    // Interface tanımlarını TS API ile al (daha kesin)
    let interfaceDefinitions: Record<string, string> = {};
    if (showInterfaces) {
      interfaceDefinitions = extractInterfacesWithApi(mgr, filePath, fullPath);
    }

    // Çıktı oluştur
    const output = formatTypeHelperOutput(conflicts, interfaceDefinitions, filePath, suggestFixes);

    return {
      success: true,
      output,
      conflicts,
      interface_definitions: interfaceDefinitions,
    };
  } catch (error) {
    logToolError("typescript-type-helper", error as Error, {});
    return {
      success: false,
      output: `❌ Error: ${String(error)}`,
      conflicts: [],
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function analyzeDiagnostic(diag: DiagnosticResult): TypeConflict | null {
  const conflict: TypeConflict = {
    error_code: diag.code,
    line: diag.line,
    column: diag.column,
    expected_type: "",
    actual_type: "",
    raw_message: diag.message,
  };

  // TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
  if (diag.code === 2345) {
    const match = diag.message.match(
      /Argument of type '([^']+)' is not assignable to parameter of type '([^']+)'/
    );
    const actualType = match?.[1];
    const expectedType = match?.[2];
    if (actualType !== undefined && expectedType !== undefined) {
      conflict.actual_type = actualType;
      conflict.expected_type = expectedType;
      conflict.suggestion = generateTypeMismatchSuggestion(
        conflict.actual_type,
        conflict.expected_type
      );
    }
  }

  // TS2322: Type 'X' is not assignable to type 'Y'
  if (diag.code === 2322) {
    const match = diag.message.match(/Type '([^']+)' is not assignable to type '([^']+)'/);
    const actualType = match?.[1];
    const expectedType = match?.[2];
    if (actualType !== undefined && expectedType !== undefined) {
      conflict.actual_type = actualType;
      conflict.expected_type = expectedType;
      conflict.suggestion = generateTypeMismatchSuggestion(
        conflict.actual_type,
        conflict.expected_type
      );
    }
  }

  // TS2339: Property 'X' does not exist on type 'Y'
  if (diag.code === 2339) {
    const match = diag.message.match(/Property '([^']+)' does not exist on type '([^']+)'/);
    const missingProp = match?.[1];
    const typeName = match?.[2];
    if (missingProp !== undefined && typeName !== undefined) {
      conflict.expected_type = typeName;
      conflict.actual_type = typeName;
      conflict.missing_fields = [missingProp];
      conflict.suggestion = `Add field '${missingProp}' to interface ${typeName}`;
    }
  }

  // TS2741: Property 'X' is missing in type 'Y' but required in type 'Z'
  if (diag.code === 2741) {
    const match = diag.message.match(
      /Property '([^']+)' is missing in type '([^']+)' but required in type '([^']+)'/
    );
    const missingProp = match?.[1];
    const actualType = match?.[2];
    const expectedType = match?.[3];
    if (missingProp !== undefined && actualType !== undefined && expectedType !== undefined) {
      conflict.actual_type = actualType;
      conflict.expected_type = expectedType;
      conflict.missing_fields = [missingProp];
      conflict.suggestion = `Add field '${missingProp}' to type ${conflict.actual_type}`;
    }
  }

  // TS2304: Cannot find name 'X'
  if (diag.code === 2304) {
    const match = diag.message.match(/Cannot find name '([^']+)'/);
    const missingName = match?.[1];
    if (missingName !== undefined) {
      conflict.actual_type = missingName;
      conflict.suggestion = `Import or declare '${missingName}'`;
    }
  }

  // TS2305: Module '"X"' has no exported member 'Y'
  if (diag.code === 2305) {
    const match = diag.message.match(/Module '"([^"]+)"' has no exported member '([^']+)'/);
    const moduleName = match?.[1];
    const memberName = match?.[2];
    if (moduleName !== undefined && memberName !== undefined) {
      conflict.actual_type = memberName;
      conflict.expected_type = moduleName;
      conflict.suggestion = `Check if '${memberName}' is exported from '${moduleName}'`;
    }
  }

  return conflict;
}

function generateTypeMismatchSuggestion(actualType: string, expectedType: string): string {
  if (actualType.includes("undefined") && !expectedType.includes("undefined")) {
    return `Add undefined check or use non-null assertion (!)`;
  }

  if (actualType.includes("null") && !expectedType.includes("null")) {
    return `Add null check before usage`;
  }

  if (actualType === "unknown") {
    return `Add type assertion: 'as ${expectedType}'`;
  }

  if (expectedType.includes("|")) {
    return `Use type narrowing or type guard`;
  }

  return `Consider using type assertion or updating the type definition`;
}

function extractInterfacesWithApi(
  mgr: ReturnType<typeof getTsLanguageService>,
  filePath: string,
  fullPath: string
): Record<string, string> {
  const interfaces: Record<string, string> = {};

  try {
    // TS API ile document symbols'den interface'leri al
    const symbols = mgr.getDocumentSymbols(filePath);
    const interfaceSymbols = symbols.filter((s) => s.kind === "interface" || s.kind === "type");

    if (interfaceSymbols.length > 0) {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (const sym of interfaceSymbols) {
        const startLine = sym.line - 1;
        const endLine = sym.endLine - 1;
        if (startLine >= 0 && endLine < lines.length) {
          const body = lines.slice(startLine, endLine + 1).join("\n");
          interfaces[sym.name] = body;
        }
      }
    }
  } catch {
    // Fallback: regex
    try {
      const content = readFileSync(fullPath, "utf-8");
      const interfaceRegex = /interface\s+(\w+)\s*\{([^}]+)\}/g;
      let match;
      while ((match = interfaceRegex.exec(content)) !== null) {
        if (match[1] !== undefined && match[2] !== undefined) {
          interfaces[match[1]] = match[2].trim();
        }
      }
    } catch {
      /* ignore */
    }
  }

  return interfaces;
}

function formatTypeHelperOutput(
  conflicts: TypeConflict[],
  interfaces: Record<string, string>,
  filePath: string,
  suggestFixes: boolean
): string {
  let output = "";

  output += "🔍 TypeScript Type Conflict Analyzer\n";
  output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += `📁 File: ${filePath}\n`;
  output += `❌ Conflicts: ${conflicts.length}\n`;
  output += `⚡ Powered by TS Language Service (instant analysis)\n`;
  output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  conflicts.forEach((conflict, idx) => {
    output += `Conflict ${idx + 1} (Line ${conflict.line}:${conflict.column}, ${conflict.error_code}):\n`;
    if (conflict.expected_type !== "") output += `  Expected: ${conflict.expected_type}\n`;
    if (conflict.actual_type !== "") output += `  Actual:   ${conflict.actual_type}\n`;

    if (conflict.missing_fields && conflict.missing_fields.length > 0) {
      output += `  Missing:  ${conflict.missing_fields.join(", ")}\n`;
    }

    if (conflict.extra_fields && conflict.extra_fields.length > 0) {
      output += `  Extra:    ${conflict.extra_fields.join(", ")}\n`;
    }

    if (suggestFixes === true && conflict.suggestion !== undefined) {
      output += `  💡 ${conflict.suggestion}\n`;
    }

    output += `  📝 ${conflict.raw_message.slice(0, 120)}\n`;
    output += "\n";
  });

  if (Object.keys(interfaces).length > 0) {
    output += "📋 Interface & Type Definitions:\n";
    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

    Object.entries(interfaces).forEach(([name, body]) => {
      output += `\n// ${name}\n${body}\n`;
    });
  }

  return output;
}

// ============================================
// MCP Tool Definition
// ============================================

export const TYPESCRIPT_TYPE_HELPER_TOOL = {
  name: "hev_dev_typescript_type_helper",
  description:
    "Type uyumsuzluklarını analiz edip çözüm önerir (interface comparison, missing fields, fix suggestions). TS Language Service powered — anında sonuç.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Analiz edilecek dosya yolu",
      },
      show_interfaces: {
        type: "boolean" as const,
        description: "Interface tanımlarını göster",
        default: true,
      },
      suggest_fixes: {
        type: "boolean" as const,
        description: "Çözüm önerileri göster",
        default: true,
      },
      analyze_conflicts: {
        type: "boolean" as const,
        description: "Type conflict'leri detaylı analiz et",
        default: true,
      },
    },
    required: ["file_path"],
  },
  metadata: {
    category: "development" as const,
    subcategory: "typescript" as const,
    priority: "medium" as const,
    complexity: "medium" as const,
    useCases: [
      "Analyze type mismatches",
      "Suggest interface improvements",
      "Identify type conflict sources",
    ],
    relatedTools: [
      "hev_dev_typescript_dashboard",
      "hev_dev_fix_typescript_batch",
      "hev_dev_ts_diagnostics",
    ],
    agentGuidance:
      "Use for deep type analysis. Uses TS Language Service for instant results (no tsc subprocess). Shows interfaces and suggests fixes. Good for understanding complex type errors.",
    requiresConfirmation: false,
    riskLevel: "low" as const,
    tags: ["typescript", "type-analysis", "interface", "conflict-resolution"],
  },
};
