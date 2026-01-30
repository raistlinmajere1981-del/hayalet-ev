/**
 * Development Tools - Error Clustering
 * 
 * Group related TypeScript errors by root cause to identify high-impact fixes.
 */

import { execSync } from 'child_process';
import path from 'path';

interface TypeScriptError {
  file: string;
  line: number;
  code: string;
  message: string;
}

interface ErrorCluster {
  id: string;
  description: string;
  errorCode: string;
  affectedFiles: Map<string, number>; // file -> error count
  totalErrors: number;
  rootCause: string;
  suggestedFix: string;
  impact: number; // errors per fix
}

/**
 * Parse TypeScript compiler output
 */
function parseTypeScriptErrors(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Match: src/file.ts(123,45): error TS1234: Message
    const match = line.match(/^(.+?)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.*)$/);
    if (match && match[1] && match[2] && match[3] && match[4]) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        code: match[3],
        message: match[4]
      });
    }
  }
  
  return errors;
}
/**
 * Extract symbol name from error message
 */
function extractSymbol(message: string, errorCode: string): string {
  // TS2304: Cannot find name 'X'
  if (errorCode === 'TS2304') {
    const match = message.match(/Cannot find name '([^']+)'/);
    if (match && match[1]) return match[1];
  }
  
  // TS18046: 'X' is of type 'unknown'
  if (errorCode === 'TS18046') {
    const match = message.match(/'([^']+)' is of type 'unknown'/);
    if (match && match[1]) return match[1];
  }
  
  // TS2722: Cannot invoke an object which is possibly 'undefined'
  if (errorCode === 'TS2722') {
    // Generic message, use file-based clustering
    return 'possibly-undefined';
  }
  
  // TS2339: Property 'X' does not exist on type 'Y'
  if (errorCode === 'TS2339') {
    const match = message.match(/Property '([^']+)' does not exist on type '([^']+)'/);
    if (match) return `${match[1]} on ${match[2]}`;
  }
  
  // TS2322: Type 'X' is not assignable to type 'Y'
  if (errorCode === 'TS2322') {
    const match = message.match(/Type '([^']+)' is not assignable/);
    if (match && match[1]) return match[1];
  }
  
  // TS2345: Argument of type 'X' is not assignable
  if (errorCode === 'TS2345') {
    const match = message.match(/Argument of type '([^']+)'/);
    if (match && match[1]) return match[1];
  }
  
  // TS2349: This expression is not callable
  if (errorCode === 'TS2349') {
    return 'not-callable';
  }
  
  return '<unknown>';
}
/**
 * Cluster errors by pattern
 */
function clusterErrors(errors: TypeScriptError[]): ErrorCluster[] {
  const clusters = new Map<string, ErrorCluster>();
  
  for (const error of errors) {
    const symbol = extractSymbol(error.message, error.code);
    const clusterId = `${error.code}-${symbol}`;
    
    if (!clusters.has(clusterId)) {
      clusters.set(clusterId, {
        id: clusterId,
        description: `${symbol} (${error.code})`,
        errorCode: error.code,
        affectedFiles: new Map(),
        totalErrors: 0,
        rootCause: '',
        suggestedFix: '',
        impact: 0
      });
    }
    
    const cluster = clusters.get(clusterId)!;
    cluster.totalErrors++;
    
    const currentCount = cluster.affectedFiles.get(error.file) || 0;
    cluster.affectedFiles.set(error.file, currentCount + 1);
  }
  
  // Analyze root causes and suggest fixes
  for (const cluster of clusters.values()) {
    analyzeCluster(cluster);
  }
  
  // Sort by impact (descending)
  return Array.from(clusters.values()).sort((a, b) => b.totalErrors - a.totalErrors);
}

/**
 * Analyze cluster and suggest fix
 */
function analyzeCluster(cluster: ErrorCluster): void {
  const code = cluster.errorCode;
  const symbol = cluster.description.split(' (')[0];
  
  if (code === 'TS2304') {
    cluster.rootCause = `Type '${symbol}' is not imported or defined`;
    cluster.suggestedFix = `Import '${symbol}' from appropriate module or define the type`;
    cluster.impact = cluster.totalErrors; // 1 fix = all errors
  } else if (code === 'TS2722' || code === 'TS18048') {
    cluster.rootCause = `'${symbol}' is possibly undefined`;
    cluster.suggestedFix = `Add null/undefined checks or use optional chaining`;
    cluster.impact = cluster.totalErrors; // Could fix all at once
  } else if (code === 'TS2322') {
    cluster.rootCause = `Type mismatch for '${symbol}'`;
    cluster.suggestedFix = `Fix type definition or add type cast`;
    cluster.impact = Math.ceil(cluster.totalErrors / cluster.affectedFiles.size); // Per-file fix
  } else if (code === 'TS2345') {
    cluster.rootCause = `Argument type mismatch`;
    cluster.suggestedFix = `Fix function signature or add type cast`;
    cluster.impact = Math.ceil(cluster.totalErrors / cluster.affectedFiles.size);
  } else {
    cluster.rootCause = `Error code ${code}`;
    cluster.suggestedFix = `Manual investigation needed`;
    cluster.impact = 1;
  }
}

/**
 * Format cluster output
 */
function formatClusters(clusters: ErrorCluster[], limit?: number): string {
  const output: string[] = [];
  const displayClusters = limit ? clusters.slice(0, limit) : clusters;
  
  output.push('\n🔍 Error Clusters:');
  output.push('━'.repeat(50));
  
  for (let i = 0; i < displayClusters.length; i++) {
    const cluster = displayClusters[i];
    if (!cluster) continue;
    
    const fileCount = cluster.affectedFiles.size;
    
    output.push(`\nCluster ${i + 1}: ${cluster.description}`);
    output.push(`  Total Errors: ${cluster.totalErrors}`);
    output.push(`  Affected Files: ${fileCount}`);
    
    // Show top 3 files
    const sortedFiles = Array.from(cluster.affectedFiles.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    for (const [file, count] of sortedFiles) {
      const shortFile = path.basename(file);
      output.push(`    - ${shortFile}: ${count} errors`);
    }
    
    if (fileCount > 3) {
      output.push(`    ... and ${fileCount - 3} more files`);
    }
    
    output.push(`  Root Cause: ${cluster.rootCause}`);
    output.push(`  Suggested Fix: ${cluster.suggestedFix}`);
    output.push(`  Impact: Fixing → Resolves ${cluster.totalErrors} errors`);
  }
  
  output.push('\n' + '━'.repeat(50));
  output.push(`\nShowing ${displayClusters.length} of ${clusters.length} clusters`);
  output.push(`Total Errors: ${clusters.reduce((sum, c) => sum + c.totalErrors, 0)}`);
  
  return output.join('\n');
}

/**
 * Run error clustering
 */
export async function errorClustering(
  projectRoot: string,
  options?: {
    limit?: number;
    errorCode?: string;
  }
): Promise<{ success: boolean; output: string }> {
  try {
    // Run TypeScript compiler
    let tscOutput = '';
    try {
      execSync('npx tsc --noEmit 2>&1', {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 30000
      });
    } catch (execError: any) {
      tscOutput = execError.stdout || execError.stderr || execError.output?.join('') || '';
    }
    
    if (!tscOutput) {
      return { success: true, output: '✅ No TypeScript errors found!' };
    }
    
    // Parse errors
    let errors = parseTypeScriptErrors(tscOutput);
    
    if (errors.length === 0) {
      return { success: true, output: '✅ No TypeScript errors found!' };
    }
    
    // Filter by error code if specified
    if (options?.errorCode) {
      errors = errors.filter(e => e.code === options.errorCode);
      if (errors.length === 0) {
        return { success: true, output: `No errors found with code ${options.errorCode}` };
      }
    }
    
    // Cluster errors
    const clusters = clusterErrors(errors);
    
    // Format output
    const output = formatClusters(clusters, options?.limit);
    
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: `❌ Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export const ERROR_CLUSTERING_TOOL = {
  name: 'hev_dev_error_clustering',
  description: 'Group related TypeScript errors by root cause. Shows which fixes have the highest impact.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'integer' as const,
        description: 'Maximum number of clusters to show (default: 10)',
        default: 10
      },
      error_code: {
        type: 'string' as const,
        description: 'Filter by specific error code (e.g., TS2722)',
      }
    }
  }
};
