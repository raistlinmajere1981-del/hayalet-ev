/**
 * Development Tools - Batch Type Fix
 * 
 * Automatically fix common TypeScript error patterns.
 */

import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';

type FixStrategy = 'add_guards' | 'add_assertions' | 'optional_chaining' | 'type_cast';

interface FixResult {
  success: boolean;
  message: string;
  fixedCount: number;
  errorsBefore: number;
  errorsAfter: number;
  diff?: string;
}

/**
 * Count TypeScript errors in a file
 */
async function countErrors(projectRoot: string, filePath: string, errorCode?: string): Promise<number> {
  try {
    let output = '';
    try {
      execSync(`npx tsc --noEmit ${filePath} 2>&1`, {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 10000
      });
    } catch (execError: any) {
      output = execError.stdout || execError.stderr || '';
    }
    
    const lines = output.split('\n');
    let count = 0;
    
    for (const line of lines) {
      if (line.includes('error TS')) {
        if (!errorCode || line.includes(errorCode)) {
          count++;
        }
      }
    }
    
    return count;
  } catch {
    return -1;
  }
}

/**
 * Strategy 1: Add guard conditions
 * Wraps code in if (obj) { ... }
 */
async function addGuards(content: string, pattern: string): Promise<string> {
  const lines = content.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      result.push('');
      continue;
    }
    
    // Detect pattern like: MessageStore?.method()
    const match = line.match(new RegExp(`(\\s*)(${pattern}\\?\\.\\w+)\\(`));
    
    if (match && match[1]) {
      const indent = match[1];
      const obj = pattern;
      
      // Check if already in guard
      const prevLine = i > 0 ? lines[i - 1] : '';
      if (prevLine && prevLine.includes(`if (${obj})`)) {
        result.push(line);
        continue;
      }
      
      // Add guard
      result.push(`${indent}if (${obj}) {`);
      result.push(line);
      result.push(`${indent}}`);
    } else {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * Strategy 2: Add non-null assertions
 * Changes obj?.method() to obj!.method()
 */
async function addAssertions(content: string, pattern: string): Promise<string> {
  // Replace optional chaining with non-null assertion
  const regex = new RegExp(`${pattern}\\?\\.`, 'g');
  return content.replace(regex, `${pattern}!.`);
}

/**
 * Strategy 3: Full optional chaining
 * Changes obj?.method() to obj?.method?.()
 */
async function improveOptionalChaining(content: string, pattern: string): Promise<string> {
  // Find pattern like: obj?.method( and change to obj?.method?.(
  const regex = new RegExp(`(${pattern}\\?\\.\\w+)\\(`, 'g');
  return content.replace(regex, '$1?.(');
}

/**
 * Apply fix strategy
 */
async function applyFix(
  content: string,
  pattern: string,
  strategy: FixStrategy
): Promise<string> {
  switch (strategy) {
    case 'add_guards':
      return await addGuards(content, pattern);
    case 'add_assertions':
      return await addAssertions(content, pattern);
    case 'optional_chaining':
      return await improveOptionalChaining(content, pattern);
    default:
      return content;
  }
}

/**
 * Batch type fix main function
 */
export async function batchTypeFix(
  projectRoot: string,
  options: {
    file_path: string;
    pattern: string;
    error_code?: string;
    fix_strategy?: FixStrategy;
    dry_run?: boolean;
  }
): Promise<FixResult> {
  try {
    const filePath = path.resolve(projectRoot, options.file_path);
    const strategy = options.fix_strategy || 'optional_chaining';
    const errorCode = options.error_code || 'TS2722';
    
    // Count errors before
    const errorsBefore = await countErrors(projectRoot, options.file_path, errorCode);
    
    if (errorsBefore === 0) {
      return {
        success: true,
        message: `✅ No ${errorCode} errors found in ${path.basename(options.file_path)}`,
        fixedCount: 0,
        errorsBefore: 0,
        errorsAfter: 0
      };
    }
    
    // Read file
    const content = await readFile(filePath, 'utf-8');
    
    // Apply fix
    const fixed = await applyFix(content, options.pattern, strategy);
    
    if (fixed === content) {
      return {
        success: true,
        message: `ℹ️  No changes made (pattern not found or already fixed)`,
        fixedCount: 0,
        errorsBefore,
        errorsAfter: errorsBefore
      };
    }
    
    // Write file (if not dry run)
    if (!options.dry_run) {
      await writeFile(filePath, fixed, 'utf-8');
    }
    
    // Count errors after
    const errorsAfter = options.dry_run ? errorsBefore : await countErrors(projectRoot, options.file_path, errorCode);
    const fixedCount = Math.max(0, errorsBefore - errorsAfter);
    
    const output: string[] = [];
    output.push(`\n🔧 Batch Type Fix: ${path.basename(options.file_path)}`);
    output.push('━'.repeat(50));
    output.push(`Strategy: ${strategy}`);
    output.push(`Pattern: ${options.pattern}`);
    output.push(`Error Code: ${errorCode}`);
    output.push(`\nErrors Before: ${errorsBefore}`);
    output.push(`Errors After: ${errorsAfter}`);
    output.push(`Fixed: ${fixedCount} errors`);
    
    if (options.dry_run) {
      output.push(`\n⚠️  DRY RUN - No changes written`);
    } else {
      output.push(`\n✅ Changes written to file`);
    }
    
    return {
      success: true,
      message: output.join('\n'),
      fixedCount,
      errorsBefore,
      errorsAfter
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      fixedCount: 0,
      errorsBefore: 0,
      errorsAfter: 0
    };
  }
}

export const BATCH_TYPE_FIX_TOOL = {
  name: 'hev_dev_batch_type_fix',
  description: 'Automatically fix common TypeScript error patterns in a file. Supports multiple strategies.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string' as const,
        description: 'Path to the file to fix (relative to project root)'
      },
      pattern: {
        type: 'string' as const,
        description: 'Symbol pattern to fix (e.g., "MessageStore")'
      },
      error_code: {
        type: 'string' as const,
        description: 'Error code to fix (default: TS2722)',
        default: 'TS2722'
      },
      fix_strategy: {
        type: 'string' as const,
        enum: ['add_guards', 'add_assertions', 'optional_chaining', 'type_cast'],
        description: 'Fix strategy: add_guards (if checks), add_assertions (non-null !), optional_chaining (?.)',
        default: 'optional_chaining'
      },
      dry_run: {
        type: 'boolean' as const,
        description: 'Preview changes without writing',
        default: false
      }
    },
    required: ['file_path', 'pattern']
  }
};
