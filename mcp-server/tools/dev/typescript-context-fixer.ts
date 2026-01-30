/**
 * Development Tools - TypeScript Context Fixer
 * 
 * Root cause finder: Analyzes TS errors and identifies missing type definitions
 * Suggests fixes in global.d.ts or type files
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";

interface ContextFixerOptions {
  file_path: string;
  error_code?: string;
  auto_fix?: boolean;
  dry_run?: boolean;
}

interface TypeDefinitionIssue {
  error_code: string;
  error_message: string;
  line: number;
  symbol: string;
  root_cause: string;
  fix_location: string;
  suggested_fix: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ContextFixerResult {
  success: boolean;
  output: string;
  issues: TypeDefinitionIssue[];
  fixes_applied?: number;
}

export async function findTypeContextIssues(
  options: ContextFixerOptions,
  projectRoot?: string
): Promise<ContextFixerResult> {
  const { file_path, error_code, auto_fix = false, dry_run = true } = options;
  const fullPath = projectRoot ? join(projectRoot, file_path) : file_path;

  try {
    // Step 1: Get TypeScript errors for this file
    const errors = getTypeScriptErrors(fullPath, projectRoot);
    
    // Step 2: Analyze root causes
    const issues = analyzeRootCauses(errors, fullPath, projectRoot);
    
    // Step 3: Filter by error code if specified
    const filteredIssues = error_code 
      ? issues.filter(i => i.error_code === error_code)
      : issues;
    
    // Step 4: Generate output
    const output = formatOutput(filteredIssues, file_path);
    
    // Step 5: Apply fixes if requested
    let fixesApplied = 0;
    if (auto_fix && !dry_run) {
      fixesApplied = await applyFixes(filteredIssues, projectRoot);
    }
    
    return {
      success: true,
      output,
      issues: filteredIssues,
      fixes_applied: fixesApplied
    };
  } catch (error) {
    logToolError("typescript-context-fixer", error as Error, {});
    return {
      success: false,
      output: `❌ Error: ${(error as Error).message}`,
      issues: []
    };
  }
}

function getTypeScriptErrors(filePath: string, projectRoot?: string): any[] {
  try {
    const cwd = projectRoot || process.cwd();
    let result = '';
    
    try {
      // Get all TypeScript errors
      // Note: tsc returns exit 1 when errors exist, so we catch and use stderr/stdout
      result = execSync(`npx tsc --noEmit 2>&1`, {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (execError: any) {
      // execSync throws on non-zero exit, but we still get output
      result = execError.stdout || execError.stderr || execError.output?.join('') || '';
    }
    
    // Parse all errors, then filter by file
    const allErrors = parseTypeScriptErrors(result);
    
    // Normalize paths for comparison (handle both absolute and relative)
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    return allErrors.filter(error => {
      const normalizedErrorFile = error.file.replace(/\\/g, '/');
      return normalizedErrorFile.includes(normalizedFilePath) || normalizedFilePath.includes(normalizedErrorFile);
    });
  } catch (error) {
    // Outer catch for unexpected errors
    return [];
  }
}

function parseTypeScriptErrors(output: string): any[] {
  const errors: any[] = [];
  const lines = output.split("\n");
  
  for (const line of lines) {
    // Parse: src/file.ts(123,45): error TS2532: Object is possibly 'undefined'.
    // Note: Message might be truncated, but we only need file/line/code for root cause
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.*)$/);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[4],
        message: match[5].trim() || 'TypeScript error' // Handle empty or truncated messages
      });
    }
  }
  
  return errors;
}

function analyzeRootCauses(
  errors: any[],
  filePath: string,
  projectRoot?: string
): TypeDefinitionIssue[] {
  const issues: TypeDefinitionIssue[] = [];
  
  for (const error of errors) {
    const issue = detectRootCause(error, filePath, projectRoot);
    if (issue) {
      issues.push(issue);
    }
  }
  
  return issues;
}

function detectRootCause(
  error: any,
  filePath: string,
  projectRoot?: string
): TypeDefinitionIssue | null {
  const { code, message, line } = error;
  
  // TS18046: 'X' is of type 'unknown'
  if (code === 'TS18046') {
    return analyzeUnknownType(error, filePath, projectRoot);
  }
  
  // TS2722: Cannot invoke possibly 'undefined'
  if (code === 'TS2722') {
    return analyzeUndefinedInvoke(error, filePath, projectRoot);
  }
  
  // TS2339: Property does not exist
  if (code === 'TS2339') {
    return analyzeMissingProperty(error, filePath, projectRoot);
  }
  
  // TS2304: Cannot find name 'X'
  if (code === 'TS2304') {
    return analyzeMissingType(error, filePath, projectRoot);
  }
  
  return null;
}

function analyzeUnknownType(
  error: any,
  filePath: string,
  projectRoot?: string
): TypeDefinitionIssue {
  // Extract symbol from message: "'window.SSEClient.on' is of type 'unknown'"
  const match = error.message.match(/'([^']+)' is of type 'unknown'/);
  const symbol = match ? match[1] : 'unknown';
  
  // Parse symbol path
  const parts = symbol.split('.');
  const rootSymbol = parts[0]; // e.g., "window"
  const property = parts.slice(1).join('.'); // e.g., "SSEClient.on"
  
  let fixLocation = 'src/js/global.d.ts';
  let suggestedFix = '';
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  
  if (rootSymbol === 'window') {
    fixLocation = 'src/js/global.d.ts';
    confidence = 'high';
    
    // Build suggested fix
    const propertyParts = property.split('.');
    const objectName = propertyParts[0]; // e.g., "SSEClient"
    const methodName = propertyParts[1]; // e.g., "on"
    
    suggestedFix = `Add method definition to ${objectName} interface:\n`;
    suggestedFix += `  ${methodName}?: (event: string, handler: (data: unknown) => void) => void;`;
  }
  
  return {
    error_code: error.code,
    error_message: error.message,
    line: error.line,
    symbol,
    root_cause: `Missing type definition for '${symbol}' in global declarations`,
    fix_location: fixLocation,
    suggested_fix: suggestedFix,
    confidence
  };
}

function analyzeUndefinedInvoke(
  error: any,
  filePath: string,
  projectRoot?: string
): TypeDefinitionIssue {
  // Extract info from source line
  const sourceCode = getSourceLine(filePath, error.line, projectRoot);
  const match = sourceCode.match(/([\w.]+)\??\.([\w]+)\(/);
  
  const symbol = match ? `${match[1]}.${match[2]}` : 'unknown';
  
  return {
    error_code: error.code,
    error_message: error.message,
    line: error.line,
    symbol,
    root_cause: `Optional property '${symbol}' needs null check or type guard`,
    fix_location: filePath,
    suggested_fix: `Wrap in guard: if (${match?.[1]} && ${match?.[1]}.${match?.[2]}) { ... }`,
    confidence: 'high'
  };
}

function analyzeMissingProperty(
  error: any,
  filePath: string,
  projectRoot?: string
): TypeDefinitionIssue {
  // Extract property from message
  const match = error.message.match(/Property '([^']+)' does not exist on type '([^']+)'/);
  const property = match ? match[1] : 'unknown';
  const typeName = match ? match[2] : 'unknown';
  
  return {
    error_code: error.code,
    error_message: error.message,
    line: error.line,
    symbol: `${typeName}.${property}`,
    root_cause: `Property '${property}' is missing from '${typeName}' type definition`,
    fix_location: `Type definition file for ${typeName}`,
    suggested_fix: `Add '${property}' to ${typeName} interface`,
    confidence: 'medium'
  };
}

function analyzeMissingType(
  error: any,
  filePath: string,
  projectRoot?: string
): TypeDefinitionIssue {
  // Extract type name from message: "Cannot find name 'PartUpdateInput'"
  const match = error.message.match(/Cannot find name '([^']+)'/);
  const typeName = match ? match[1] : 'unknown';
  
  return {
    error_code: error.code,
    error_message: error.message,
    line: error.line,
    symbol: typeName,
    root_cause: `Type '${typeName}' is not imported or defined`,
    fix_location: filePath,
    suggested_fix: `Import '${typeName}' from appropriate module or define it in type declarations`,
    confidence: 'high'
  };
}

function getSourceLine(
  filePath: string,
  lineNumber: number,
  projectRoot?: string
): string {
  try {
    const fullPath = projectRoot ? join(projectRoot, filePath) : filePath;
    if (!existsSync(fullPath)) return '';
    
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    return lines[lineNumber - 1] || '';
  } catch {
    return '';
  }
}

function formatOutput(issues: TypeDefinitionIssue[], filePath: string): string {
  if (issues.length === 0) {
    return `✅ No root cause issues found in ${filePath}`;
  }
  
  let output = `🔍 TypeScript Context Analysis: ${filePath}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  output += `Found ${issues.length} root cause issue(s):\n\n`;
  
  // Group by confidence
  const highConfidence = issues.filter(i => i.confidence === 'high');
  const mediumConfidence = issues.filter(i => i.confidence === 'medium');
  const lowConfidence = issues.filter(i => i.confidence === 'low');
  
  const groups = [
    { title: '🎯 High Confidence Fixes', items: highConfidence },
    { title: '⚡ Medium Confidence Fixes', items: mediumConfidence },
    { title: '💡 Low Confidence Suggestions', items: lowConfidence }
  ];
  
  for (const group of groups) {
    if (group.items.length === 0) continue;
    
    output += `${group.title}:\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    for (let i = 0; i < group.items.length; i++) {
      const issue = group.items[i];
      output += `\n${i + 1}. Line ${issue.line}: ${issue.error_code}\n`;
      output += `   Symbol: ${issue.symbol}\n`;
      output += `   Root Cause: ${issue.root_cause}\n`;
      output += `   Fix Location: ${issue.fix_location}\n`;
      output += `   Suggested Fix:\n`;
      output += `   ${issue.suggested_fix.replace(/\n/g, '\n   ')}\n`;
    }
    
    output += `\n`;
  }
  
  return output;
}

async function applyFixes(
  issues: TypeDefinitionIssue[],
  projectRoot?: string
): Promise<number> {
  // TODO: Implement auto-fix logic
  // For now, just return 0
  return 0;
}

// Tool definition
export const TYPESCRIPT_CONTEXT_FIXER_TOOL = {
  name: "hev_dev_typescript_context_fixer",
  description: "Analyzes TypeScript errors and identifies root causes in type definitions. Suggests fixes for global.d.ts or interface files.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "File path to analyze"
      },
      error_code: {
        type: "string",
        description: "Filter by specific error code (e.g., TS18046, TS2722)"
      },
      auto_fix: {
        type: "boolean",
        description: "Attempt to auto-fix issues (experimental)",
        default: false
      },
      dry_run: {
        type: "boolean",
        description: "Preview fixes without applying",
        default: true
      }
    },
    required: ["file_path"]
  }
};
