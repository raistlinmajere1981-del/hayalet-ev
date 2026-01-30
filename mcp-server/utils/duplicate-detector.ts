/**
 * Context-Aware Duplicate Detection
 * 
 * AST-based scope detection to eliminate false positives.
 * Only flags duplicates within the same scope (function, class, block).
 * Includes template/boilerplate exception for documentation files.
 */

import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { readFile } from 'fs/promises';

/**
 * Template patterns that are allowed to repeat (documentation, config files)
 */
const TEMPLATE_PATTERNS = [
  /^\*\*Category:\*\*/,           // Markdown: **Category:** Development
  /^\*\*Prefix:\*\*/,              // Markdown: **Prefix:** `hev_dev_*`
  /^\*\*Description:\*\*/,         // Markdown: **Description:** ...
  /^\*\*Tool:\*\*/,                // Markdown: **Tool:** tool_name
  /^\*\*Use Case:\*\*/,            // Markdown: **Use Case:** ...
  /^\*\*When:\*\*/,                // Markdown: **When:** ...
  /^\*\*Impact:\*\*/,              // Markdown: **Impact:** ...
  /^\*\*Status:\*\*/,              // Markdown: **Status:** ...
  /^---+$/,                        // Markdown: horizontal separators
  /^===+$/,                        // Markdown: heading underlines
  /^#{1,6}\s/,                     // Markdown: headings
  /^\s*\|\s*[-:]+\s*\|/,          // Markdown: table separators
  /^import\s+.*from\s+['"].*['"];?$/, // ES6 imports
  /^export\s+\{.*\}\s+from/,       // ES6 re-exports
  /^\s*\/\/\s*TODO:/,              // TODO comments
  /^\s*\/\/\s*FIXME:/,             // FIXME comments
  /^\s*console\.(log|warn|error)\(/, // Console statements
];

/**
 * Check if a line matches any template pattern
 */
function isTemplatePattern(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true; // Empty lines are templates
  return TEMPLATE_PATTERNS.some(pattern => pattern.test(trimmed));
}

interface ScopeInfo {
  type: 'function' | 'class' | 'method' | 'block' | 'switch-case' | 'interface' | 'type-alias' | 'file';
  name: string;
  startLine: number;
  endLine: number;
  parentScope?: ScopeInfo;
}

interface DuplicateInfo {
  line1: number;
  line2: number;
  content: string;
  scope: string;
}

/**
 * Build a map of line numbers to their scope information
 */
function buildScopeMap(ast: TSESTree.Program): Map<number, ScopeInfo> {
  const scopeMap = new Map<number, ScopeInfo>();
  
  const fileScope: ScopeInfo = {
    type: 'file',
    name: '<file>',
    startLine: 0,
    endLine: Infinity
  };
  
  function visit(node: TSESTree.Node, currentScope: ScopeInfo) {
    if (!node.loc) return;
    
    const start = node.loc.start.line;
    const end = node.loc.end.line;
    
    let newScope: ScopeInfo | null = null;
    
    // Detect scope-creating nodes
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      const funcNode = node as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
      newScope = {
        type: 'function',
        name: ('id' in funcNode && funcNode.id?.name) || '<anonymous>',
        startLine: start,
        endLine: end,
        parentScope: currentScope
      };
    } else if (node.type === 'ClassDeclaration') {
      const classNode = node as TSESTree.ClassDeclaration;
      newScope = {
        type: 'class',
        name: classNode.id?.name || '<anonymous>',
        startLine: start,
        endLine: end,
        parentScope: currentScope
      };
    } else if (node.type === 'MethodDefinition') {
      const methodNode = node as TSESTree.MethodDefinition;
      newScope = {
        type: 'method',
        name: methodNode.key.type === 'Identifier' ? methodNode.key.name : '<computed>',
        startLine: start,
        endLine: end,
        parentScope: currentScope
      };
    } else if (node.type === 'TSInterfaceDeclaration') {
      const interfaceNode = node as TSESTree.TSInterfaceDeclaration;
      newScope = {
        type: 'interface',
        name: interfaceNode.id?.name || '<anonymous>',
        startLine: start,
        endLine: end,
        parentScope: currentScope
      };
    } else if (node.type === 'TSTypeAliasDeclaration') {
      const typeNode = node as TSESTree.TSTypeAliasDeclaration;
      newScope = {
        type: 'type-alias',
        name: typeNode.id?.name || '<anonymous>',
        startLine: start,
        endLine: end,
        parentScope: currentScope
      };
    } else if (node.type === 'SwitchCase') {
      const caseNode = node as TSESTree.SwitchCase;
      const caseValue = caseNode.test?.type === 'Literal' ? String(caseNode.test.value) : '<default>';
      newScope = {
        type: 'switch-case',
        name: `case ${caseValue}`,
        startLine: start,
        endLine: end,
        parentScope: currentScope
      };
    } else if (node.type === 'BlockStatement') {
      // Only create scope for blocks that are not part of function/class
      if (currentScope.type !== 'function' && currentScope.type !== 'method' && currentScope.type !== 'class') {
        newScope = {
          type: 'block',
          name: `<block@${start}>`,
          startLine: start,
          endLine: end,
          parentScope: currentScope
        };
      }
    }
    
    const scopeToUse = newScope || currentScope;
    
    // Map all lines in this node to the current scope
    for (let line = start; line <= end; line++) {
      if (!scopeMap.has(line) || (newScope && scopeMap.get(line)?.type === 'file')) {
        scopeMap.set(line, scopeToUse);
      }
    }
    
    // Visit children
    const keys = Object.keys(node) as Array<keyof typeof node>;
    for (const key of keys) {
      const child = node[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach((item: any) => {
            if (item && typeof item === 'object' && 'type' in item) {
              visit(item as TSESTree.Node, scopeToUse);
            }
          });
        } else if ('type' in child) {
          visit(child as TSESTree.Node, scopeToUse);
        }
      }
    }
  }
  
  visit(ast as TSESTree.Node, fileScope);
  
  return scopeMap;
}

/**
 * Check if two scopes are the same
 */
function areSameScope(scope1: ScopeInfo, scope2: ScopeInfo): boolean {
  // Must be same type
  if (scope1.type !== scope2.type) return false;
  
  // Must have same range
  if (scope1.startLine !== scope2.startLine || scope1.endLine !== scope2.endLine) {
    return false;
  }
  
  // For switch-case, also check parent scope (different functions = different scope)
  if (scope1.type === 'switch-case') {
    // If both have parent scopes, they must match
    if (scope1.parentScope && scope2.parentScope) {
      return areSameScope(scope1.parentScope, scope2.parentScope);
    }
    // If one has parent and other doesn't, they're different
    if (scope1.parentScope || scope2.parentScope) {
      return false;
    }
  }
  
  // For function, method, class, interface, type-alias: name and range is enough
  if (scope1.type === 'function' || scope1.type === 'method' || scope1.type === 'class' ||
      scope1.type === 'interface' || scope1.type === 'type-alias') {
    return scope1.name === scope2.name;
  }
  
  // For blocks and file: range is enough (already checked above)
  return true;
}

/**
 * Detect context-aware duplicates
 */
export async function detectContextAwareDuplicates(
  filePath: string,
  changedLineStart: number,
  changedLineEnd: number,
  searchRadius: number = 20
): Promise<DuplicateInfo[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Parse AST (only for JS/TS files)
    const ext = filePath.toLowerCase();
    const isCodeFile = ext.endsWith('.ts') || ext.endsWith('.tsx') || 
                       ext.endsWith('.js') || ext.endsWith('.jsx') ||
                       ext.endsWith('.mjs') || ext.endsWith('.cjs');
    
    if (!isCodeFile) {
      // Fallback to simple detection for non-code files
      return detectSimpleDuplicates(lines, changedLineStart, changedLineEnd, searchRadius);
    }
    
    let ast: TSESTree.Program;
    try {
      ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      });
    } catch (parseError) {
      // Syntax error - fallback to simple detection
      return detectSimpleDuplicates(lines, changedLineStart, changedLineEnd, searchRadius);
    }
    
    // Build scope map
    const scopeMap = buildScopeMap(ast);
    
    // Find duplicates
    const duplicates: DuplicateInfo[] = [];
    const changedLines = lines.slice(changedLineStart, changedLineEnd);
    
    for (let i = 0; i < changedLines.length; i++) {
      const changedLine = (changedLines[i] || '').trim();
      if (changedLine.length < 10) continue; // Skip short lines
      if (changedLine.startsWith('//') || changedLine.startsWith('/*')) continue; // Skip comments
      if (isTemplatePattern(changedLine)) continue; // Skip template patterns
      
      const changedLineNum = changedLineStart + i + 1; // 1-based
      const changedScope = scopeMap.get(changedLineNum);
      
      // Check lines before and after the changed region
      const searchStart = Math.max(0, changedLineStart - searchRadius);
      const searchEnd = Math.min(lines.length, changedLineEnd + searchRadius);
      
      for (let j = searchStart; j < searchEnd; j++) {
        // Skip the changed region itself
        if (j >= changedLineStart && j < changedLineEnd) continue;
        
        const compareLine = (lines[j] || '').trim();
        if (changedLine === compareLine && compareLine.length > 0) {
          const compareLineNum = j + 1; // 1-based
          const compareScope = scopeMap.get(compareLineNum);
          
          // Only flag if in the same scope
          if (changedScope && compareScope && areSameScope(changedScope, compareScope)) {
            duplicates.push({
              line1: changedLineNum,
              line2: compareLineNum,
              content: changedLine,
              scope: changedScope.name || changedScope.type
            });
            break; // Only report first duplicate
          }
        }
      }
    }
    
    return duplicates;
  } catch (error) {
    // On any error, return empty array (don't block the operation)
    console.error('Duplicate detection error:', error);
    return [];
  }
}

/**
 * Fallback: Simple duplicate detection (original logic)
 */
function detectSimpleDuplicates(
  lines: string[],
  changedLineStart: number,
  changedLineEnd: number,
  searchRadius: number
): DuplicateInfo[] {
  const duplicates: DuplicateInfo[] = [];
  const changedLines = lines.slice(changedLineStart, changedLineEnd);
  
  for (let i = 0; i < changedLines.length; i++) {
    const changedLine = (changedLines[i] || '').trim();
    if (changedLine.length < 10) continue;
    if (isTemplatePattern(changedLine)) continue; // Skip template patterns
    
    const changedLineNum = changedLineStart + i + 1;
    const searchStart = Math.max(0, changedLineStart - searchRadius);
    const searchEnd = Math.min(lines.length, changedLineEnd + searchRadius);
    
    for (let j = searchStart; j < searchEnd; j++) {
      if (j >= changedLineStart && j < changedLineEnd) continue;
      
      const compareLine = (lines[j] || '').trim();
      if (changedLine === compareLine && compareLine.length > 0) {
        duplicates.push({
          line1: changedLineNum,
          line2: j + 1,
          content: changedLine,
          scope: '<unknown>'
        });
        break;
      }
    }
  }
  
  return duplicates;
}
