/**
 * Development Tools - TypeScript Type Inference Helper
 * 
 * Type uyumsuzluklarını analiz edip çözüm önerir
 */

import { readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";

interface TypeHelperOptions {
  file_path: string;
  show_interfaces?: boolean;
  suggest_fixes?: boolean;
  analyze_conflicts?: boolean;
}

interface TypeConflict {
  error_code: string;
  line: number;
  expected_type: string;
  actual_type: string;
  missing_fields?: string[];
  extra_fields?: string[];
  suggestion?: string;
}

interface TypeHelperResult {
  success: boolean;
  output: string;
  conflicts: TypeConflict[];
  interface_definitions?: Record<string, string>;
}

export async function analyzeTypeConflicts(
  options: TypeHelperOptions,
  projectRoot?: string
): Promise<TypeHelperResult> {
  const {
    file_path,
    show_interfaces = true,
    suggest_fixes = true,
    analyze_conflicts = true,
  } = options;

  const fullPath = projectRoot ? join(projectRoot, file_path) : file_path;

  try {
    // Get TypeScript errors for this file
    const errors = await getTypescriptErrorsForFile(file_path, projectRoot); // Use relative path for grep
    
    // Filter type mismatch errors
    const typeMismatchErrors = errors.filter((err) =>
      ["TS2345", "TS2322", "TS2339", "TS2741"].includes(err.code)
    );

    if (typeMismatchErrors.length === 0) {
      // Check if there are other errors
      const otherErrors = errors.filter((err) =>
        !["TS2345", "TS2322", "TS2339", "TS2741"].includes(err.code)
      );
      
      let message = "✅ No type mismatch conflicts (TS2345, TS2322, TS2339, TS2741) found.\\n";
      
      if (otherErrors.length > 0) {
        message += `\\n⚠️  However, ${otherErrors.length} other TypeScript errors found:\\n`;
        otherErrors.slice(0, 10).forEach((err) => {
          const truncatedMsg = err.message.length > 80 ? err.message.slice(0, 80) + '...' : err.message;
          message += `  Line ${err.line}: ${err.code} - ${truncatedMsg}\\n`;
        });
        if (otherErrors.length > 10) {
          message += `  ... and ${otherErrors.length - 10} more errors\\n`;
        }
        message += "\\n📊 Use hev_dev_typescript_dashboard for full overview.";
      } else if (errors.length === 0) {
        message += "\\n✨ No TypeScript errors found in this file!";
      }
      
      return {
        success: true,
        output: message,
        conflicts: [],
      };
    }

    // Analyze each conflict
    const conflicts: TypeConflict[] = [];
    const fileContent = readFileSync(fullPath, "utf-8");

    for (const error of typeMismatchErrors) {
      const conflict = analyzeError(error, fileContent);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    // Extract interface definitions if requested
    let interfaceDefinitions: Record<string, string> = {};
    if (show_interfaces) {
      interfaceDefinitions = extractInterfaces(fileContent);
    }

    // Generate output
    const output = formatTypeHelperOutput(
      conflicts,
      interfaceDefinitions,
      file_path,
      suggest_fixes
    );

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
      output: `❌ Error: ${error}`,
      conflicts: [],
    };
  }
}

// ============================================
// Helper Functions
// ============================================

async function getTypescriptErrorsForFile(
  filePath: string,
  projectRoot?: string
): Promise<
  Array<{ line: number; column: number; code: string; message: string }>
> {
  try {
    const cwd = projectRoot || process.cwd();
    let result = '';
    
    try {
      result = execSync(
        `npx tsc --noEmit 2>&1 | grep '${filePath}' | grep 'error TS' || true`,
        { cwd, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
      );
    } catch (execError: any) {
      // Capture stderr/stdout even on error
      result = execError.stdout || execError.stderr || '';
    }

    const errors: Array<{
      line: number;
      column: number;
      code: string;
      message: string;
    }> = [];

    result.split("\n").forEach((line) => {
      const match = line.match(/\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/);
      if (match && match[1] && match[2] && match[3] && match[4]) {
        errors.push({
          line: parseInt(match[1], 10),
          column: parseInt(match[2], 10),
          code: match[3],
          message: match[4],
        });
      }
    });

    return errors;
  } catch (error) {
    logToolError('typescript-type-helper', error as Error, {});
    return [];
  }
}

function analyzeError(
  error: { line: number; column: number; code: string; message: string },
  fileContent: string
): TypeConflict | null {
  const lines = fileContent.split("\n");
  const line = lines[error.line - 1];

  if (!line) return null;

  // Parse type mismatch messages
  const conflict: TypeConflict = {
    error_code: error.code,
    line: error.line,
    expected_type: "",
    actual_type: "",
  };

  // TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
  if (error.code === "TS2345") {
    const match = error.message.match(
      /Argument of type '([^']+)' is not assignable to parameter of type '([^']+)'/
    );
    if (match && match[1] && match[2]) {
      conflict.actual_type = match[1];
      conflict.expected_type = match[2];
      conflict.suggestion = generateTypeMismatchSuggestion(
        conflict.actual_type,
        conflict.expected_type
      );
    }
  }

  // TS2322: Type 'X' is not assignable to type 'Y'
  if (error.code === "TS2322") {
    const match = error.message.match(
      /Type '([^']+)' is not assignable to type '([^']+)'/
    );
    if (match && match[1] && match[2]) {
      conflict.actual_type = match[1];
      conflict.expected_type = match[2];
      conflict.suggestion = generateTypeMismatchSuggestion(
        conflict.actual_type,
        conflict.expected_type
      );
    }
  }

  // TS2339: Property 'X' does not exist on type 'Y'
  if (error.code === "TS2339") {
    const match = error.message.match(
      /Property '([^']+)' does not exist on type '([^']+)'/
    );
    if (match && match[1] && match[2]) {
      const missingProp: string = match[1];
      const typeName: string = match[2];
      conflict.expected_type = typeName;
      conflict.actual_type = typeName;
      conflict.missing_fields = [missingProp];
      conflict.suggestion = `Add field '${missingProp}' to interface ${typeName}`;
    }
  }

  // TS2741: Property 'X' is missing in type 'Y' but required in type 'Z'
  if (error.code === "TS2741") {
    const match = error.message.match(
      /Property '([^']+)' is missing in type '([^']+)' but required in type '([^']+)'/
    );
    if (match && match[1] && match[2] && match[3]) {
      const missingProp: string = match[1];
      conflict.actual_type = match[2];
      conflict.expected_type = match[3];
      conflict.missing_fields = [missingProp];
      conflict.suggestion = `Add field '${missingProp}' to type ${conflict.actual_type}`;
    }
  }

  return conflict;
}

function generateTypeMismatchSuggestion(
  actualType: string,
  expectedType: string
): string {
  // Simple heuristics
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

function extractInterfaces(content: string): Record<string, string> {
  const interfaces: Record<string, string> = {};
  const interfaceRegex = /interface\s+(\w+)\s*{([^}]+)}/g;

  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      interfaces[match[1]] = match[2].trim();
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

  // Header
  output += "🔍 TypeScript Type Conflict Analyzer\n";
  output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  output += `📁 File: ${filePath}\n`;
  output += `❌ Conflicts: ${conflicts.length}\n`;
  output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  // List conflicts
  conflicts.forEach((conflict, idx) => {
    output += `Conflict ${idx + 1} (Line ${conflict.line}, ${conflict.error_code}):\n`;
    output += `  Expected: ${conflict.expected_type}\n`;
    output += `  Actual:   ${conflict.actual_type}\n`;

    if (conflict.missing_fields && conflict.missing_fields.length > 0) {
      output += `  Missing:  ${conflict.missing_fields.join(", ")}\n`;
    }

    if (conflict.extra_fields && conflict.extra_fields.length > 0) {
      output += `  Extra:    ${conflict.extra_fields.join(", ")}\n`;
    }

    if (suggestFixes && conflict.suggestion) {
      output += `  💡 ${conflict.suggestion}\n`;
    }

    output += "\n";
  });

  // Show relevant interfaces
  if (Object.keys(interfaces).length > 0) {
    output += "📋 Interface Definitions:\n";
    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

    Object.entries(interfaces).forEach(([name, body]) => {
      output += `\ninterface ${name} {\n`;
      output += `  ${body.replace(/\n/g, "\n  ")}\n`;
      output += `}\n`;
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
    "Type uyumsuzluklarını analiz edip çözüm önerir (interface comparison, missing fields, fix suggestions)",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Analiz edilecek dosya yolu",
      },
      show_interfaces: {
        type: "boolean",
        description: "Interface tanımlarını göster",
        default: true,
      },
      suggest_fixes: {
        type: "boolean",
        description: "Çözüm önerileri göster",
        default: true,
      },
      analyze_conflicts: {
        type: "boolean",
        description: "Type conflict'leri detaylı analiz et",
        default: true,
      },
    },
    required: ["file_path"],
  },
};
