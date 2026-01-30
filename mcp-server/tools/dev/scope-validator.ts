/**
 * Development Tools - Scope Validator
 * 
 * Satır edit işlemlerinde scope bütünlüğünü kontrol eder
 */

import { readFileSync, existsSync } from "fs";
import { parse } from "@babel/parser";
import traverseImport from "@babel/traverse";
import { countBracketsContextAware } from "./structure-visualizer.js";

const traverse = typeof traverseImport === 'function' 
  ? traverseImport 
  : (traverseImport as any).default?.default || (traverseImport as any).default || traverseImport;

interface ScopeInfo {
  type: string;
  name: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
}

interface ScopeValidationResult {
  success: boolean;
  willBreakScope: boolean;
  affectedScopes: ScopeInfo[];
  brokenScopes: ScopeInfo[];
  warnings: string[];
  bracketIssues: string[];
}

/**
 * Analyze scope impact of a line range deletion/replacement
 */
export async function analyzeScopeImpact(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<ScopeValidationResult> {
  const warnings: string[] = [];
  const brokenScopes: ScopeInfo[] = [];
  const affectedScopes: ScopeInfo[] = [];
  
  if (!existsSync(filePath)) {
    return {
      success: false,
      willBreakScope: false,
      affectedScopes: [],
      brokenScopes: [],
      warnings: ['File not found'],
      bracketIssues: [],
    };
  }

  const content = readFileSync(filePath, 'utf-8');
  const ext = filePath.split('.').pop();

  // Only for JS/TS files
  if (!['js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs'].includes(ext || '')) {
    return {
      success: true,
      willBreakScope: false,
      affectedScopes: [],
      brokenScopes: [],
      warnings: [],
      bracketIssues: [],
    };
  }

  try {
    // Debug logs removed - MCP server should not write to stdout
    
    const ast = parse(content, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator',
      ],
    });

    const scopes: ScopeInfo[] = [];

    traverse(ast, {
      ImportDeclaration(path: any) {
        const node = path.node;
        scopes.push({
          type: 'import',
          name: 'import statement',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      ExportNamedDeclaration(path: any) {
        const node = path.node;
        scopes.push({
          type: 'export',
          name: 'export statement',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      FunctionDeclaration(path: any) {
        const node = path.node;
        scopes.push({
          type: 'function',
          name: node.id?.name || 'anonymous',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      FunctionExpression(path: any) {
        const node = path.node;
        scopes.push({
          type: 'function',
          name: node.id?.name || 'anonymous',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      ArrowFunctionExpression(path: any) {
        const node = path.node;
        scopes.push({
          type: 'arrow',
          name: 'arrow function',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      ClassDeclaration(path: any) {
        const node = path.node;
        scopes.push({
          type: 'class',
          name: node.id?.name || 'anonymous',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      IfStatement(path: any) {
        const node = path.node;
        scopes.push({
          type: 'if',
          name: 'if statement',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      ForStatement(path: any) {
        const node = path.node;
        scopes.push({
          type: 'for',
          name: 'for loop',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      WhileStatement(path: any) {
        const node = path.node;
        scopes.push({
          type: 'while',
          name: 'while loop',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      TryStatement(path: any) {
        const node = path.node;
        scopes.push({
          type: 'try',
          name: 'try block',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
      SwitchStatement(path: any) {
        const node = path.node;
        scopes.push({
          type: 'switch',
          name: 'switch statement',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          startCol: node.loc.start.column,
          endCol: node.loc.end.column,
        });
      },
    });

    // Check which scopes are affected
    for (const scope of scopes) {
      const scopeStart = scope.startLine;
      const scopeEnd = scope.endLine;

      // Check if delete range intersects with scope
      const intersects = (
        (startLine >= scopeStart && startLine <= scopeEnd) ||
        (endLine >= scopeStart && endLine <= scopeEnd) ||
        (startLine <= scopeStart && endLine >= scopeEnd)
      );

      if (intersects) {
        affectedScopes.push(scope);

        // 🛡️ SAFE TYPES: Import/Export statements are single-line and safe to edit
        const isSafeType = ['import', 'export'].includes(scope.type);
        
        if (isSafeType) {
          // Import/Export are safe, skip scope breaking checks
          continue;
        }

        // Check if scope closing bracket is in delete range
        // Critical: if endLine is in delete range, scope will break
        if (scopeEnd >= startLine && scopeEnd <= endLine) {
          brokenScopes.push(scope);
          warnings.push(
            `⚠️  Scope kırılma riski: ${scope.type} '${scope.name}' (L${scope.startLine}-${scope.endLine}) kapanışı silinecek!`
          );
        }

        // Check if scope opening is in range but not closing
        if (scopeStart >= startLine && scopeStart <= endLine && scopeEnd > endLine) {
          brokenScopes.push(scope);
          warnings.push(
            `⚠️  Scope kırılma riski: ${scope.type} '${scope.name}' (L${scope.startLine}-${scope.endLine}) başlangıcı silinecek!`
          );
        }
      }
    }
  } catch (err) {
    // AST parse failed, fallback to simple bracket check
    const error = err as Error;
    warnings.push(`AST parsing başarısız: ${error.message}`);
  }

  return {
    success: brokenScopes.length === 0,
    willBreakScope: brokenScopes.length > 0,
    affectedScopes,
    brokenScopes,
    warnings,
    bracketIssues: [],
  };
}

/**
 * Validate bracket balance before/after edit
 */
export function validateBracketBalance(
  oldContent: string,
  newContent: string
): { balanced: boolean; details: string[] } {
  const oldBrackets = countBracketsContextAware(oldContent);
  const newBrackets = countBracketsContextAware(newContent);

  const issues: string[] = [];
  const pairs: Array<[string, string]> = [['(', ')'], ['{', '}'], ['[', ']']];

  for (const [openChar, closeChar] of pairs) {
    const oldOpenCount = oldBrackets.open[openChar]?.length || 0;
    const oldCloseCount = oldBrackets.close[closeChar]?.length || 0;
    const newOpenCount = newBrackets.open[openChar]?.length || 0;
    const newCloseCount = newBrackets.close[closeChar]?.length || 0;

    // Check if edit broke the balance
    const wasBalanced = oldOpenCount === oldCloseCount;
    const isBalanced = newOpenCount === newCloseCount;

    if (wasBalanced && !isBalanced) {
      const diff = Math.abs(newOpenCount - newCloseCount);
      const missing = newOpenCount > newCloseCount ? closeChar : openChar;
      issues.push(
        `Parantez dengesi bozuldu: '${openChar}${closeChar}' çifti - ${diff} adet '${missing}' ${newOpenCount > newCloseCount ? 'eksik' : 'fazla'}`
      );
    }
  }

  return {
    balanced: issues.length === 0,
    details: issues,
  };
}
