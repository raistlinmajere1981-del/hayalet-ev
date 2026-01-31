#!/usr/bin/env node
/**
 * Add Metadata to Tool Definitions
 * 
 * Automatically adds metadata to existing tool definitions
 * based on tool name patterns and categories.
 * 
 * Usage: node scripts/add-tool-metadata.js [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Tool metadata inference rules
 * Based on tool name patterns
 */
const METADATA_RULES = {
  // === CRITICAL TOOLS (TOP 10) ===
  'hev_fs_show': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'critical',
    complexity: 'simple',
    useCases: ['Before any edit', 'Duplicate check', 'File inspection'],
    relatedTools: ['hev_dev_edit_lines', 'hev_dev_check_syntax'],
    agentGuidance: 'ALWAYS use before editing a file. Shows content with line numbers.',
    requiresConfirmation: false,
    riskLevel: 'low'
  },
  'hev_dev_edit_lines': {
    category: 'development',
    subcategory: 'code-editing',
    priority: 'critical',
    complexity: 'medium',
    useCases: ['Multi-line code editing', 'Function refactoring', 'Safe block replacement'],
    relatedTools: ['hev_fs_show', 'hev_dev_check_syntax', 'hev_fs_undo'],
    agentGuidance: 'Primary editing tool. Use safe_mode: true for auto-rollback. ALWAYS hev_fs_show before and hev_dev_check_syntax after.',
    requiresConfirmation: false,
    riskLevel: 'medium'
  },
  'hev_dev_check_syntax': {
    category: 'development',
    subcategory: 'validation',
    priority: 'critical',
    complexity: 'simple',
    useCases: ['After any edit', 'Bracket validation', 'Syntax verification'],
    relatedTools: ['hev_dev_edit_lines', 'hev_fs_undo'],
    agentGuidance: 'MANDATORY after every file edit. Detects syntax errors and bracket mismatches.',
    requiresConfirmation: false,
    riskLevel: 'low'
  },
  'hev_dev_typescript_dashboard': {
    category: 'development',
    subcategory: 'typescript',
    priority: 'critical',
    complexity: 'simple',
    useCases: ['TypeScript error analysis', 'Session baseline', 'Progress tracking'],
    relatedTools: ['hev_dev_safe_batch_refactor', 'hev_dev_fix_typescript_batch'],
    agentGuidance: 'Start here for any TypeScript issue. Shows error distribution and recommendations.',
    requiresConfirmation: false,
    riskLevel: 'low'
  },
  'hev_dev_safe_batch_refactor': {
    category: 'development',
    subcategory: 'refactoring',
    priority: 'critical',
    complexity: 'complex',
    useCases: ['50+ similar errors', 'Batch pattern replacement', 'Large-scale refactoring'],
    relatedTools: ['hev_dev_typescript_dashboard', 'hev_dev_edit_lines'],
    agentGuidance: 'Use for 50+ changes. Has auto-rollback. Always verify_after_each: true.',
    requiresConfirmation: true,
    riskLevel: 'high',
    estimatedIterations: 20
  },
  'hev_fs_find_and_replace': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'critical',
    complexity: 'simple',
    useCases: ['Simple string replace', 'Single-line changes', 'Quick fixes'],
    relatedTools: ['hev_dev_edit_lines', 'hev_fs_show'],
    agentGuidance: 'Tier 1 tool for simple replacements. Use hev_dev_edit_lines for multi-line.',
    requiresConfirmation: false,
    riskLevel: 'low'
  },
  'hev_fs_bash': {
    category: 'filesystem',
    subcategory: 'advanced',
    priority: 'critical',
    complexity: 'medium',
    useCases: ['Shell commands', 'Build/test', 'Git operations'],
    relatedTools: ['hev_dev_test_run', 'hev_git_create_pr'],
    agentGuidance: 'Preferred over Rovo built-in bash (logged). Use for complex batch operations.',
    requiresConfirmation: false,
    riskLevel: 'medium'
  },
  'hev_read_electron_logs': {
    category: 'core',
    subcategory: 'debugging',
    priority: 'critical',
    complexity: 'medium',
    useCases: ['Debug Electron app', 'Error investigation', 'Log analysis'],
    relatedTools: ['hev_get_error_hints', 'hev_collect_error_context'],
    agentGuidance: 'Essential for debugging. Use filters (source, level) to narrow down.',
    requiresConfirmation: false,
    riskLevel: 'low'
  },
  'hev_mcp_health': {
    category: 'core',
    subcategory: 'health',
    priority: 'critical',
    complexity: 'simple',
    useCases: ['Session start health check', 'Tool troubleshooting'],
    relatedTools: ['hev_list_tools'],
    agentGuidance: 'Use at session start or when tools fail. If fails, built-in tools are active (RISKY).',
    requiresConfirmation: false,
    riskLevel: 'low'
  },
  'hev_dev_fix_typescript_batch': {
    category: 'development',
    subcategory: 'typescript',
    priority: 'critical',
    complexity: 'complex',
    useCases: ['20-30 TypeScript errors', 'Undefined checks', 'Auto-fix patterns'],
    relatedTools: ['hev_dev_typescript_dashboard', 'hev_dev_safe_batch_refactor'],
    agentGuidance: 'For TS2722/TS2532 errors. Auto-applies fixes. Use with caution.',
    requiresConfirmation: true,
    riskLevel: 'high',
    estimatedIterations: 15
  },
};

/**
 * Infer metadata from tool name
 */
function inferMetadata(toolName) {
  // Check explicit rules first
  if (METADATA_RULES[toolName]) {
    return METADATA_RULES[toolName];
  }
  
  // Infer from patterns
  let metadata = {
    category: 'core',
    priority: 'medium',
    complexity: 'simple',
    useCases: [],
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: []
  };
  
  // Category inference
  if (toolName.startsWith('hev_fs_')) {
    metadata.category = 'filesystem';
    metadata.subcategory = inferFSSubcategory(toolName);
  } else if (toolName.startsWith('hev_dev_')) {
    metadata.category = 'development';
    metadata.subcategory = inferDevSubcategory(toolName);
  } else if (toolName.startsWith('hev_context_')) {
    metadata.category = 'context';
  } else if (toolName.startsWith('hev_git_')) {
    metadata.category = 'git';
  } else if (toolName.startsWith('hev_web_')) {
    metadata.category = 'web';
  } else if (toolName.startsWith('hev_run_')) {
    metadata.category = 'workflow';
  } else if (toolName.includes('provider') || toolName.includes('validate_')) {
    metadata.category = 'provider';
  } else if (toolName.includes('electron') || toolName.includes('cdp') || 
             toolName.includes('screenshot') || toolName.includes('click')) {
    metadata.category = 'electron';
  }
  
  // Priority inference
  if (toolName.includes('dashboard') || toolName.includes('health')) {
    metadata.priority = 'high';
  }
  
  // Complexity inference
  if (toolName.includes('batch') || toolName.includes('refactor') || toolName.includes('workflow')) {
    metadata.complexity = 'complex';
  } else if (toolName.includes('edit') || toolName.includes('fix')) {
    metadata.complexity = 'medium';
  }
  
  // Risk and confirmation
  if (toolName.includes('batch') || toolName.includes('refactor') || 
      toolName.includes('delete') || toolName.includes('pr')) {
    metadata.requiresConfirmation = true;
    metadata.riskLevel = 'high';
  } else if (toolName.includes('edit') || toolName.includes('fix') || toolName.includes('replace')) {
    metadata.riskLevel = 'medium';
  }
  
  // Tags
  metadata.tags = extractTags(toolName);
  
  return metadata;
}

function inferFSSubcategory(toolName) {
  if (toolName.includes('show') || toolName.includes('create') || toolName.includes('open')) {
    return 'basic-io';
  } else if (toolName.includes('backup') || toolName.includes('undo') || toolName.includes('history')) {
    return 'history';
  } else if (toolName.includes('grep') || toolName.includes('search')) {
    return 'search';
  } else if (toolName.includes('chunk')) {
    return 'chunked-write';
  }
  return 'advanced';
}

function inferDevSubcategory(toolName) {
  if (toolName.includes('typescript') || toolName.includes('type')) {
    return 'typescript';
  } else if (toolName.includes('eslint') || toolName.includes('lint')) {
    return 'eslint';
  } else if (toolName.includes('edit') || toolName.includes('insert')) {
    return 'code-editing';
  } else if (toolName.includes('test')) {
    return 'testing';
  } else if (toolName.includes('analyze') || toolName.includes('dashboard')) {
    return 'analysis';
  }
  return 'development';
}

function extractTags(toolName) {
  const tags = [];
  const words = toolName.replace('hev_', '').split('_');
  words.forEach(word => {
    if (word.length > 3 && !['show', 'list', 'tool'].includes(word)) {
      tags.push(word);
    }
  });
  return tags.slice(0, 3); // Max 3 tags
}

/**
 * Process tools-registry.ts and add metadata
 */
function processToolRegistry() {
  const filePath = join(PROJECT_ROOT, 'mcp-server/core/tools-registry.ts');
  let content = readFileSync(filePath, 'utf-8');
  
  // Find all tool definitions without metadata
  const toolRegex = /\{\s*name:\s*["']([^"']+)["'],\s*description:[^}]+inputSchema:[^}]+\},?\s*(?!metadata)/gs;
  
  let matches = [];
  let match;
  while ((match = toolRegex.exec(content)) !== null) {
    matches.push({
      toolName: match[1],
      matchText: match[0],
      index: match.index
    });
  }
  
  console.log(`Found ${matches.length} tools without metadata`);
  
  if (matches.length === 0) {
    console.log('All tools already have metadata!');
    return;
  }
  
  // Process in reverse order to maintain indices
  matches.reverse().forEach(({ toolName, matchText, index }) => {
    const metadata = inferMetadata(toolName);
    
    // Generate metadata block
    const metadataBlock = generateMetadataBlock(metadata);
    
    // Insert metadata before closing brace
    const newToolDef = matchText.replace(/\},?\s*$/, `,\n${metadataBlock}\n  } as EnhancedToolDefinition,`);
    
    content = content.substring(0, index) + newToolDef + content.substring(index + matchText.length);
    
    console.log(`✓ Added metadata to ${toolName}`);
  });
  
  if (!DRY_RUN) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`\n✅ Updated ${filePath}`);
  } else {
    console.log('\n🔍 DRY RUN - No changes made');
  }
}

function generateMetadataBlock(metadata) {
  const lines = [];
  lines.push('    metadata: {');
  lines.push(`      category: '${metadata.category}',`);
  if (metadata.subcategory) {
    lines.push(`      subcategory: '${metadata.subcategory}',`);
  }
  lines.push(`      priority: '${metadata.priority}',`);
  lines.push(`      complexity: '${metadata.complexity}',`);
  
  if (metadata.useCases && metadata.useCases.length > 0) {
    lines.push(`      useCases: [${metadata.useCases.map(uc => `'${uc}'`).join(', ')}],`);
  }
  
  if (metadata.relatedTools && metadata.relatedTools.length > 0) {
    lines.push(`      relatedTools: [${metadata.relatedTools.map(t => `'${t}'`).join(', ')}],`);
  }
  
  if (metadata.agentGuidance) {
    lines.push(`      agentGuidance: '${metadata.agentGuidance}',`);
  }
  
  lines.push(`      requiresConfirmation: ${metadata.requiresConfirmation},`);
  lines.push(`      riskLevel: '${metadata.riskLevel}',`);
  
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`      tags: [${metadata.tags.map(t => `'${t}'`).join(', ')}]`);
  }
  
  if (metadata.estimatedIterations) {
    lines.push(`,\n      estimatedIterations: ${metadata.estimatedIterations}`);
  }
  
  lines.push('    }');
  
  return lines.join('\n');
}

console.log('🔧 Tool Metadata Adder\n');
processToolRegistry();

