/**
 * Development Tools - Syntax Checker
 * 
 * Dosyada syntax hataları, parantez dengesi ve ESLint kontrolleri
 */

import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { execSync } from "child_process";
import { logToolError } from "../../utils/mcp-logger.js";

// Detaylı bracket counting helper (structure-visualizer.ts'den import edilecek)
import { countBracketsContextAware } from "./structure-visualizer.js";

interface SyntaxCheckResult {
  success: boolean;
  output: string;
  errors: Array<{ message: string; line?: number; column?: number; type: string }>;
  bracketsBalanced: boolean;
  bracketDetails?: Array<{ open: number; close: number; type: string }>;
}

export async function checkSyntax(
  filePath: string,
  options: {
    checkBrackets?: boolean;
    checkEslint?: boolean;
    checkTs?: boolean;
  } = {},
  projectRoot?: string
): Promise<SyntaxCheckResult> {
  const checkBrackets = options.checkBrackets !== false;
  const checkEslint = options.checkEslint !== false;
  const checkTs = options.checkTs !== false;
  
  const output: string[] = [];
  const errors: Array<{ message: string; line?: number; column?: number; type: string }> = [];
  
  const fullPath = projectRoot ? join(projectRoot, filePath) : filePath;
  
  if (!existsSync(fullPath)) {
    return {
      success: false,
      output: `❌ Dosya bulunamadı: ${filePath}`,
      errors: [{ message: 'File not found', type: 'system' }],
      bracketsBalanced: false,
    };
  }

  const content = readFileSync(fullPath, 'utf-8');
  const ext = extname(filePath);
  
  output.push(`🔍 Syntax Kontrolü: ${filePath}`);
  output.push('─'.repeat(50));

  let bracketsBalanced = true;
  const bracketDetails: { open: number; close: number; type: string }[] = [];
  
  if (checkBrackets) {
    const bracketCounts = countBracketsContextAware(content);
    
    const brackets = [
      { open: '(', close: ')', name: 'Parantez' },
      { open: '{', close: '}', name: 'Süslü Parantez' },
      { open: '[', close: ']', name: 'Köşeli Parantez' },
    ];

    for (const bracket of brackets) {
      const openCount = bracketCounts.open[bracket.open]?.length || 0;
      const closeCount = bracketCounts.close[bracket.close]?.length || 0;
      
      bracketDetails.push({
        open: openCount,
        close: closeCount,
        type: bracket.name,
      });

      if (openCount !== closeCount) {
        bracketsBalanced = false;
        const diff = Math.abs(openCount - closeCount);
        const missing = openCount > closeCount ? bracket.close : bracket.open;
        errors.push({
          message: `${bracket.name} dengesi bozuk: ${diff} adet '${missing}' ${openCount > closeCount ? 'eksik' : 'fazla'}`,
          type: 'bracket',
        });
      }
    }

    if (bracketsBalanced) {
      output.push('✅ Parantez Dengesi: OK');
    } else {
      output.push('❌ Parantez Dengesi: BOZUK');
      for (const detail of bracketDetails) {
        if (detail.open !== detail.close) {
          output.push(`   ${detail.type}: ${detail.open} açık / ${detail.close} kapalı`);
        }
      }
    }
    output.push('─'.repeat(50));
  }

  if (checkEslint && projectRoot && /\.(ts|js|tsx|jsx)$/.test(ext)) {
    try {
      execSync(`npx eslint "${filePath}" --format stylish`, {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 15000,
      });
      output.push('✅ ESLint: Hata yok');
    } catch (err: any) {
      const eslintOutput = err.stdout || err.stderr || '';
      
      const errorMatch = eslintOutput.match(/(\d+) errors?/);
      const warningMatch = eslintOutput.match(/(\d+) warnings?/);
      const errorCount = errorMatch ? parseInt(errorMatch[1]) : 0;
      const warningCount = warningMatch ? parseInt(warningMatch[1]) : 0;

      if (errorCount > 0 || warningCount > 0) {
        output.push(`❌ ESLint: ${errorCount} hata, ${warningCount} uyarı`);
        errors.push({
          message: `ESLint: ${errorCount} error(s), ${warningCount} warning(s)`,
          type: 'eslint',
        });
      }
    }
    output.push('─'.repeat(50));
  }

  if (checkTs && projectRoot && /\.(ts|tsx)$/.test(ext)) {
    try {
      execSync(`npx tsc --noEmit "${filePath}"`, {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 15000,
      });
      output.push('✅ TypeScript: Hata yok');
    } catch (err: any) {
      const tsOutput = err.stdout || err.stderr || '';
      const tsErrors = tsOutput.match(/error TS\d+:/g);
      
      if (tsErrors) {
        output.push(`❌ TypeScript: ${tsErrors.length} hata`);
        errors.push({
          message: `TypeScript: ${tsErrors.length} error(s)`,
          type: 'typescript',
        });
      }
    }
    output.push('─'.repeat(50));
  }

  const totalErrors = errors.length;
  if (totalErrors === 0) {
    output.push('✅ Toplam: Hata bulunamadı');
  } else {
    output.push(`❌ Toplam: ${totalErrors} hata bulundu`);
  }

  return {
    success: totalErrors === 0,
    output: output.join('\n'),
    errors,
    bracketsBalanced,
    bracketDetails,
  };
}

export const SYNTAX_CHECKER_TOOL = {
  name: "hev_dev_check_syntax",
  description: "Dosyada syntax hataları, parantez dengesi ve ESLint kontrolleri yap",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string" as const,
        description: "Dosya yolu",
      },
      check_brackets: {
        type: "boolean" as const,
        description: "Parantez dengesi kontrolü",
        default: true,
      },
      check_eslint: {
        type: "boolean" as const,
        description: "ESLint syntax check",
        default: true,
      },
      check_ts: {
        type: "boolean" as const,
        description: "TypeScript type check",
        default: false,
      },
    },
    required: ["file_path"],
  },
};
