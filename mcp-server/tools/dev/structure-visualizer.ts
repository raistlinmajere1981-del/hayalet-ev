/**
 * Development Tools - Structure Visualizer
 * 
 * Dosya yapısını görselleştir: AST tree, scope hierarchy, bracket analysis
 */

import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { logToolError } from "../../utils/mcp-logger.js";

// Copy full implementation from dev-tools.ts lines 1293-1785
export async function visualizeStructure(
  projectRoot: string,
  filePath: string,
  options: {
    showScopes?: boolean;
    showBrackets?: boolean;
    showComments?: boolean;
    showStrings?: boolean;
    maxDepth?: number;
  } = {}
): Promise<{
  success: boolean;
  output: string;
  tree?: any;
  errors: string[];
}> {
  const { 
    showScopes = true, 
    showBrackets = true, 
    showComments = true,
    showStrings = false,
    maxDepth = 10 
  } = options;
  
  const fullPath = join(projectRoot, filePath);
  const errors: string[] = [];
  const output: string[] = [];
  
  if (!existsSync(fullPath)) {
    return {
      success: false,
      output: `❌ Dosya bulunamadı: ${filePath}`,
      errors: ['File not found'],
    };
  }

  const content = readFileSync(fullPath, 'utf-8');
  const ext = extname(filePath);
  const lines = content.split('\n');
  
  output.push(`🔍 Dosya Yapısı: ${filePath}`);
  output.push('═'.repeat(50));
  output.push('');

  let scopeCount = 0; // Track scope count outside try block

  // Try AST parsing for JS/TS files
  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    try {
      const { parse } = await import('@babel/parser');
      const traverseImport: any = await import('@babel/traverse');
      // Handle both CommonJS and ESM imports
      const traverse = typeof traverseImport === 'function' 
        ? traverseImport 
        : traverseImport.default?.default || traverseImport.default || traverseImport;
      
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

      if (showScopes) {
        output.push('📦 SCOPE HIERARCHY:');
        output.push('━'.repeat(50));
        
        const scopes: Array<{
          type: string;
          name: string;
          start: number;
          end: number;
          startLine: number;
          endLine: number;
          parent?: any;
        }> = [];

        traverse(ast, {
          FunctionDeclaration(path: any) {
            const node = path.node;
            scopes.push({
              type: 'function',
              name: node.id?.name || 'anonymous',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          FunctionExpression(path: any) {
            const node = path.node;
            scopes.push({
              type: 'function',
              name: node.id?.name || 'anonymous',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          ArrowFunctionExpression(path: any) {
            const node = path.node;
            scopes.push({
              type: 'arrow',
              name: 'arrow function',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          ClassDeclaration(path: any) {
            const node = path.node;
            scopes.push({
              type: 'class',
              name: node.id?.name || 'anonymous',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          IfStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'if',
              name: 'if statement',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          ForStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'for',
              name: 'for loop',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          WhileStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'while',
              name: 'while loop',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          TryStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'try',
              name: 'try block',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
          SwitchStatement(path: any) {
            const node = path.node;
            scopes.push({
              type: 'switch',
              name: 'switch statement',
              start: node.start,
              end: node.end,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
            });
          },
        });

        // Sort by start line
        scopes.sort((a, b) => a.startLine - b.startLine);

        // Build hierarchy
        const rootScopes = scopes.filter(s => 
          !scopes.some(parent => 
            parent.start < s.start && parent.end > s.end && parent !== s
          )
        );

        const renderScope = (scope: any, depth: number = 0, prefix: string = '') => {
          if (depth > maxDepth) return;
          
          const indent = '  '.repeat(depth);
          const lineRange = `${scope.startLine}-${scope.endLine}`;
          const icon = scope.type === 'function' ? '⚡' : 
                      scope.type === 'class' ? '🏛️' : 
                      scope.type === 'if' ? '🔀' :
                      scope.type === 'for' || scope.type === 'while' ? '🔁' :
                      scope.type === 'try' ? '🛡️' :
                      scope.type === 'switch' ? '🎛️' : '📦';
          
          const status = scope.endLine ? '✅' : '❌ UNCLOSED';
          
          output.push(`${indent}${lineRange.padEnd(8)} │ ${prefix}${icon} ${scope.name.padEnd(25)} ${status}`);

          // Find children
          const children = scopes.filter(child => 
            child.start > scope.start && 
            child.end < scope.end &&
            !scopes.some(between => 
              between.start > scope.start && 
              between.end < scope.end &&
              between.start < child.start && 
              between.end > child.end &&
              between !== child
            )
          );

          children.forEach((child, idx) => {
            const isLast = idx === children.length - 1;
            const childPrefix = isLast ? '└─ ' : '├─ ';
            renderScope(child, depth + 1, childPrefix);
          });
        };

        rootScopes.forEach(scope => renderScope(scope));
        
        output.push('━'.repeat(50));
        output.push('');
        
        scopeCount = scopes.length; // Save count before leaving scope
      }

      output.push(`✅ AST parse başarılı (${scopeCount} scope bulundu)`);

    } catch (err) {
      const error = err as Error;
      errors.push(`AST parse error: ${error.message}`);
      output.push(`⚠️  AST parse başarısız, fallback mod kullanılıyor...`);
      output.push('');
    }
  }

  // Bracket analysis (always run, context-aware)
  if (showBrackets) {
    output.push('');
    output.push('🔗 BRACKET ANALYSIS:');
    output.push('━'.repeat(50));
    
    const bracketCounts = countBracketsContextAware(content);
    const unclosedBrackets: Array<{ char: string; line: number; col: number }> = [];
    const extraBrackets: Array<{ char: string; line: number; col: number }> = [];
    
    // Calculate unclosed and extra brackets
    const bracketPairs = { '(': ')', '{': '}', '[': ']' };
    
    for (const [openChar, closeChar] of Object.entries(bracketPairs)) {
      const openList = bracketCounts.open[openChar];
      const closeList = bracketCounts.close[closeChar];
      
      if (!openList || !closeList) continue;
      
      if (openList.length > closeList.length) {
        // More opens than closes - some are unclosed
        const diff = openList.length - closeList.length;
        unclosedBrackets.push(...openList.slice(-diff).map(b => ({ char: openChar, ...b })));
      } else if (closeList.length > openList.length) {
        // More closes than opens - some are extra
        const diff = closeList.length - openList.length;
        extraBrackets.push(...closeList.slice(-diff).map(b => ({ char: closeChar, ...b })));
      }
    }

    if (unclosedBrackets.length === 0 && extraBrackets.length === 0) {
      output.push('✅ Tüm parantezler dengeli');
    } else {
      if (unclosedBrackets.length > 0) {
        output.push(`❌ Kapanmamış parantezler (${unclosedBrackets.length}):`);
        unclosedBrackets.slice(0, 5).forEach(b => {
          output.push(`   Line ${b.line}, Col ${b.col}: '${b.char}' kapanmamış`);
        });
        if (unclosedBrackets.length > 5) {
          output.push(`   ... ve ${unclosedBrackets.length - 5} tane daha`);
        }
      }
      
      if (extraBrackets.length > 0) {
        output.push(`❌ Fazla kapanış parantezleri (${extraBrackets.length}):`);
        extraBrackets.slice(0, 5).forEach(b => {
          output.push(`   Line ${b.line}, Col ${b.col}: '${b.char}' açılış yok`);
        });
        if (extraBrackets.length > 5) {
          output.push(`   ... ve ${extraBrackets.length - 5} tane daha`);
        }
      }
    }
    
    output.push('━'.repeat(50));
  }

  // Comment analysis
  if (showComments) {
    output.push('');
    output.push('💬 COMMENT BLOCKS:');
    output.push('━'.repeat(50));
    
    const commentBlocks: Array<{ type: string; start: number; end?: number }> = [];
    let inMultilineComment = false;
    let multilineStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // Single line comments
      if (line.includes('//')) {
        const idx = line.indexOf('//');
        commentBlocks.push({ type: 'single', start: i + 1 });
      }
      
      // Multi-line comments
      if (line.includes('/*')) {
        inMultilineComment = true;
        multilineStart = i + 1;
      }
      
      if (inMultilineComment && line.includes('*/')) {
        commentBlocks.push({ type: 'multi', start: multilineStart, end: i + 1 });
        inMultilineComment = false;
      }
    }

    if (inMultilineComment) {
      commentBlocks.push({ type: 'multi', start: multilineStart, end: undefined });
      errors.push(`Unclosed multi-line comment starting at line ${multilineStart}`);
    }

    if (commentBlocks.length === 0) {
      output.push('   (Yorum bloğu yok)');
    } else {
      const singleComments = commentBlocks.filter(c => c.type === 'single');
      const multiComments = commentBlocks.filter(c => c.type === 'multi');
      
      output.push(`   Single-line: ${singleComments.length}`);
      output.push(`   Multi-line: ${multiComments.length}`);
      
      multiComments.slice(0, 5).forEach(c => {
        if (c.end) {
          output.push(`   Line ${c.start}-${c.end}: /* ... */ ✅`);
        } else {
          output.push(`   Line ${c.start}: /* ... ❌ UNCLOSED`);
        }
      });
    }
    
    output.push('━'.repeat(50));
  }

  output.push('');
  output.push(`📊 Total Lines: ${lines.length}`);
  
  if (errors.length > 0) {
    output.push('');
    output.push('⚠️  ISSUES DETECTED:');
    errors.forEach(err => output.push(`   • ${err}`));
  }

  return {
    success: errors.length === 0,
    output: output.join('\n'),
    errors,
  };
}

/**
 * Context-aware bracket counting (ignores brackets inside strings and regexes)
 */
export function countBracketsContextAware(content: string): {
  open: { [key: string]: Array<{ line: number; col: number }> };
  close: { [key: string]: Array<{ line: number; col: number }> };
  balanced: boolean;
} {
  const lines = content.split('\n');
  const open: { [key: string]: Array<{ line: number; col: number }> } = { '(': [], '{': [], '[': [] };
  const close: { [key: string]: Array<{ line: number; col: number }> } = { ')': [], '}': [], ']': [] };
  
  let inString = false;
  let stringChar = '';
  let inRegex = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line) continue;
    inSingleLineComment = false; // Reset at start of each line
    
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      const prevChar = col > 0 ? line[col - 1] : '';
      const nextChar = col < line.length - 1 ? line[col + 1] : '';
      
      // Skip if in single-line comment
      if (inSingleLineComment) continue;
      
      // Multi-line comment detection
      if (!inString && !inRegex && char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        col++; // Skip next char
        continue;
      }
      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        col++; // Skip next char
        continue;
      }
      if (inMultiLineComment) continue;
      
      // Single-line comment detection
      if (!inString && !inRegex && char === '/' && nextChar === '/') {
        inSingleLineComment = true;
        continue;
      }
      
      // String detection (with escape handling)
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString && !inRegex) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          inString = false;
          stringChar = '';
        }
        continue;
      }
      
      // Skip if in string
      if (inString) continue;
      
      // Regex detection with proper escape handling
      if (char === '/' && !inRegex) {
        // Check if this / is escaped by counting preceding backslashes
        let backslashCount = 0;
        let checkPos = col - 1;
        while (checkPos >= 0 && line[checkPos] === '\\') {
          backslashCount++;
          checkPos--;
        }
        // If odd number of backslashes, the / is escaped
        const isEscaped = backslashCount % 2 === 1;
        
        if (!isEscaped) {
          // Check if previous non-whitespace token suggests division operator
          let prevTokenEnd = col - 1;
          while (prevTokenEnd >= 0 && line[prevTokenEnd] && /\s/.test(line[prevTokenEnd]!)) {
            prevTokenEnd--;
          }
          
          // If previous token ends with identifier, digit, or closing bracket, it's division
          const prevTokenChar = prevTokenEnd >= 0 && line[prevTokenEnd] ? line[prevTokenEnd]! : '';
          const isDivision = /[\w$)\]]/.test(prevTokenChar);
          
          if (!isDivision) {
            const beforeChars = ['=', '(', ',', ':', '[', '{', ';', '!', '&', '|', 'return', 'throw'];
            const charBefore = (checkPos >= 0 && line[checkPos]) ? line[checkPos]! : '';
            const isRegexStart = beforeChars.includes(charBefore) || col === 0;
            
            if (isRegexStart) {
              inRegex = true;
              continue;
            }
          }
        }
      } else if (char === '/' && inRegex) {
        // Check if regex-ending / is escaped
        let backslashCount = 0;
        let checkPos = col - 1;
        while (checkPos >= 0 && line[checkPos] === '\\') {
          backslashCount++;
          checkPos--;
        }
        const isEscaped = backslashCount % 2 === 1;
        
        if (!isEscaped) {
          // Verify this is truly regex end by checking next char (flags or delimiter)
          const regexFlags = ['i', 'g', 'm', 's', 'u', 'y', '.', ' ', ')', ';', ',', '}', ']'];
          const isRegexEnd = (nextChar && regexFlags.includes(nextChar)) || col === line.length - 1;
          
          if (isRegexEnd) {
            inRegex = false;
            continue;
          }
        }
      }
      
      // Skip if in regex
      if (inRegex) continue;
      
      // Skip generic types (< and >)
      // TypeScript: Map<string, number>, Record<K, V>, Array<T>
      let isGenericType = false;
      if (char === '<' || char === '>') {
        // Check if this is likely a generic type
        // Pattern: word< or >, or <word
        const prevWord = line.substring(Math.max(0, col - 10), col).match(/[A-Za-z_$][\w$]*$/);
        const nextWord = line.substring(col + 1, Math.min(line.length, col + 11)).match(/^[A-Za-z_$][\w$]*/);
        
        if (prevWord || nextWord || (char === '>' && line[col + 1] === '>')) {
          isGenericType = true;
        }
      }
      
      // Count brackets (only outside strings, regexes, comments, and generic types)
      if (!isGenericType) {
        if (char === '(' || char === '{' || char === '[') {
          open[char]?.push({ line: lineIdx + 1, col: col + 1 });
        } else if (char === ')' || char === '}' || char === ']') {
          close[char]?.push({ line: lineIdx + 1, col: col + 1 });
        }
      }
    }
  }
  
  // Check balance
  const balanced = 
    (open['(']?.length ?? 0) === (close[')']?.length ?? 0) &&
    (open['{']?.length ?? 0) === (close['}']?.length ?? 0) &&
    (open['[']?.length ?? 0) === (close[']']?.length ?? 0);
  
  return { open, close, balanced };
}

// ============================================
// MCP Tool Definition
// ============================================

export const STRUCTURE_VISUALIZER_TOOL = {
  name: "hev_dev_visualize_structure",
  description: "Dosya yapısını görselleştir (AST scope tree, bracket analysis, unclosed detection)",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Analiz edilecek dosya yolu",
      },
      show_scopes: {
        type: "boolean",
        description: "Scope hierarchy göster",
        default: true,
      },
      show_brackets: {
        type: "boolean",
        description: "Bracket analysis göster",
        default: true,
      },
      show_comments: {
        type: "boolean",
        description: "Comment blocks göster",
        default: false,
      },
      show_strings: {
        type: "boolean",
        description: "String literals göster",
        default: false,
      },
      max_depth: {
        type: "number",
        description: "Maksimum scope derinliği",
        default: 10,
      },
    },
    required: ["file_path"],
  },
};
