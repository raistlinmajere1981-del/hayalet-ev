#!/usr/bin/env node
/**
 * Batch Metadata Adder
 * 
 * 94 tool'a otomatik metadata ekler (inference rules + patterns).
 * 
 * @version 1.0.0
 * @created 2026-01-31
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Metadata templates by category
 */
const METADATA_TEMPLATES = {
  // === FILESYSTEM ===
  'hev_fs_show': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'critical',
    complexity: 'simple',
    useCases: ['Before any edit', 'File inspection', 'Line number reference'],
    relatedTools: ['hev_dev_edit_lines', 'hev_fs_find_and_replace'],
    agentGuidance: 'ALWAYS use before editing. Shows file content with line numbers.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['read', 'inspect', 'mandatory']
  },
  
  'hev_fs_open_files': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['Open multiple files', 'Quick overview'],
    relatedTools: ['hev_fs_show'],
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['read', 'multiple']
  },
  
  'hev_fs_create_file': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'high',
    complexity: 'simple',
    useCases: ['Create new file', 'Initialize config'],
    relatedTools: ['hev_fs_show', 'hev_dev_check_syntax'],
    agentGuidance: 'Use for new files. Check syntax after creation.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['create', 'write']
  },
  
  'hev_fs_delete_file': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['Delete file (recoverable)', 'Cleanup'],
    relatedTools: ['hev_fs_restore', 'hev_fs_trash_list'],
    agentGuidance: 'Moves to trash (recoverable). Use hev_fs_restore to undo.',
    requiresConfirmation: false,
    riskLevel: 'medium',
    tags: ['delete', 'trash', 'recoverable']
  },
  
  'hev_fs_move_file': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['Rename file', 'Move to different directory'],
    relatedTools: ['hev_fs_show'],
    requiresConfirmation: false,
    riskLevel: 'medium',
    tags: ['move', 'rename']
  },
  
  'hev_fs_find_and_replace': {
    category: 'filesystem',
    subcategory: 'basic-io',
    priority: 'critical',
    complexity: 'simple',
    useCases: ['Simple string replace', 'Single-line fix'],
    relatedTools: ['hev_fs_show', 'hev_dev_edit_lines'],
    agentGuidance: 'For simple replacements. Use hev_dev_edit_lines for multi-line.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['replace', 'simple', 'safe']
  },
  
  'hev_fs_grep': {
    category: 'filesystem',
    subcategory: 'search',
    priority: 'high',
    complexity: 'medium',
    useCases: ['Search in files', 'Find pattern', 'Regex search'],
    relatedTools: ['hev_dev_search_symbol', 'hev_fs_show'],
    agentGuidance: 'Powerful search with regex + glob. Use for finding code patterns.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['search', 'regex', 'glob']
  },
  
  'hev_fs_bash': {
    category: 'filesystem',
    subcategory: 'advanced',
    priority: 'critical',
    complexity: 'medium',
    useCases: ['Shell commands', 'Build/test', 'Git operations'],
    relatedTools: ['hev_dev_test_run', 'hev_git_create_pr'],
    agentGuidance: 'Preferred over Rovo built-in bash (logged). Use for complex operations.',
    requiresConfirmation: false,
    riskLevel: 'medium',
    tags: ['shell', 'command', 'advanced']
  },
  
  'hev_fs_expand_folder': {
    category: 'filesystem',
    subcategory: 'navigation',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['Show folder structure', 'Project overview'],
    relatedTools: ['hev_fs_show', 'hev_dev_analyze_project'],
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['folder', 'tree', 'structure']
  },
  
  // Backup & History
  'hev_fs_backup': {
    category: 'filesystem',
    subcategory: 'history',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['Create backup before risky operation', 'Version control'],
    relatedTools: ['hev_fs_restore', 'hev_fs_undo'],
    agentGuidance: 'Use before batch operations. Creates timestamped backup.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['backup', 'safety', 'version']
  },
  
  'hev_fs_restore': {
    category: 'filesystem',
    subcategory: 'history',
    priority: 'high',
    complexity: 'simple',
    useCases: ['Restore from trash', 'Undo delete'],
    relatedTools: ['hev_fs_trash_list', 'hev_fs_delete_file'],
    agentGuidance: 'Recovers deleted files. Check hev_fs_trash_list first.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['restore', 'recover', 'undo']
  },
  
  'hev_fs_undo': {
    category: 'filesystem',
    subcategory: 'history',
    priority: 'high',
    complexity: 'simple',
    useCases: ['Undo last operation', 'Quick rollback'],
    relatedTools: ['hev_fs_history', 'hev_fs_backup'],
    agentGuidance: 'Reverts last file operation. Limited to recent changes.',
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['undo', 'rollback', 'safety']
  },
  
  'hev_fs_history': {
    category: 'filesystem',
    subcategory: 'history',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['View operation history', 'Audit trail'],
    relatedTools: ['hev_fs_undo', 'hev_fs_backup'],
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['history', 'audit', 'log']
  },
  
  'hev_fs_trash_list': {
    category: 'filesystem',
    subcategory: 'history',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['List deleted files', 'Find file to restore'],
    relatedTools: ['hev_fs_restore', 'hev_fs_trash_empty'],
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['trash', 'list', 'deleted']
  },
  
  'hev_fs_trash_empty': {
    category: 'filesystem',
    subcategory: 'history',
    priority: 'low',
    complexity: 'simple',
    useCases: ['Empty trash', 'Cleanup'],
    relatedTools: ['hev_fs_trash_list'],
    agentGuidance: 'PERMANENT deletion. Use with caution.',
    requiresConfirmation: true,
    riskLevel: 'high',
    tags: ['trash', 'delete', 'permanent']
  },
  
  'hev_fs_diff': {
    category: 'filesystem',
    subcategory: 'comparison',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['Compare two files', 'Show differences'],
    relatedTools: ['hev_fs_diff_content', 'hev_dev_git_diff'],
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['diff', 'compare', 'changes']
  },
  
  'hev_fs_diff_content': {
    category: 'filesystem',
    subcategory: 'comparison',
    priority: 'medium',
    complexity: 'simple',
    useCases: ['Compare text blocks', 'Before/after comparison'],
    relatedTools: ['hev_fs_diff'],
    requiresConfirmation: false,
    riskLevel: 'low',
    tags: ['diff', 'content', 'compare']
  },
};

/**
 * Inference rules for remaining tools
 */
function inferMetadata(toolName, description) {
  const meta = {
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
    meta.category = 'filesystem';
    meta.subcategory = inferFSSubcategory(toolName);
  } else if (toolName.startsWith('hev_dev_')) {
    meta.category = 'development';
    meta.subcategory = inferDevSubcategory(toolName);
  } else if (toolName.startsWith('hev_context_')) {
    meta.category = 'context';
  } else if (toolName.startsWith('hev_git_')) {
    meta.category = 'git';
  } else if (toolName.startsWith('hev_web_')) {
    meta.category = 'web';
  } else if (toolName.startsWith('hev_run_')) {
    meta.category = 'workflow';
  } else if (toolName.includes('provider')) {
    meta.category = 'provider';
  } else {
    meta.category = 'electron';
    meta.subcategory = inferElectronSubcategory(toolName);
  }
  
  // Priority inference
  if (toolName.includes('dashboard') || toolName.includes('health') || toolName.includes('check')) {
    meta.priority = 'high';
  }
  
  if (toolName.includes('batch') || toolName.includes('safe') || toolName.includes('refactor')) {
    meta.priority = 'critical';
  }
  
  // Complexity inference
  if (toolName.includes('batch') || toolName.includes('refactor') || toolName.includes('workflow')) {
    meta.complexity = 'complex';
  } else if (toolName.includes('edit') || toolName.includes('fix') || toolName.includes('analyze')) {
    meta.complexity = 'medium';
  }
  
  // Risk and confirmation
  if (toolName.includes('batch') || toolName.includes('empty') || toolName.includes('refactor') || toolName.includes('pr')) {
    meta.requiresConfirmation = true;
    meta.riskLevel = 'high';
  } else if (toolName.includes('edit') || toolName.includes('fix') || toolName.includes('delete')) {
    meta.riskLevel = 'medium';
  }
  
  // Tags from tool name
  meta.tags = extractTags(toolName);
  
  // Use cases from description
  meta.useCases = [description.split('.')[0]];
  
  return meta;
}

function inferFSSubcategory(toolName) {
  if (toolName.includes('show') || toolName.includes('create') || toolName.includes('open') || toolName.includes('delete') || toolName.includes('move')) {
    return 'basic-io';
  } else if (toolName.includes('backup') || toolName.includes('undo') || toolName.includes('history') || toolName.includes('trash') || toolName.includes('restore')) {
    return 'history';
  } else if (toolName.includes('grep') || toolName.includes('search')) {
    return 'search';
  } else if (toolName.includes('chunk')) {
    return 'chunked-write';
  } else if (toolName.includes('diff')) {
    return 'comparison';
  } else if (toolName.includes('expand')) {
    return 'navigation';
  }
  return 'advanced';
}

function inferDevSubcategory(toolName) {
  if (toolName.includes('typescript') || toolName.includes('type')) {
    return 'typescript';
  } else if (toolName.includes('eslint') || toolName.includes('lint')) {
    return 'eslint';
  } else if (toolName.includes('edit') || toolName.includes('insert') || toolName.includes('smart')) {
    return 'code-editing';
  } else if (toolName.includes('test')) {
    return 'testing';
  } else if (toolName.includes('analyze') || toolName.includes('dashboard') || toolName.includes('visualize') || toolName.includes('search')) {
    return 'analysis';
  } else if (toolName.includes('refactor') || toolName.includes('batch')) {
    return 'refactoring';
  } else if (toolName.includes('check') || toolName.includes('syntax')) {
    return 'validation';
  }
  return 'development';
}

function inferElectronSubcategory(toolName) {
  if (toolName.includes('log')) {
    return 'debugging';
  } else if (toolName.includes('click') || toolName.includes('fill') || toolName.includes('scroll') || toolName.includes('key')) {
    return 'interaction';
  } else if (toolName.includes('screenshot') || toolName.includes('window')) {
    return 'capture';
  } else if (toolName.includes('dom') || toolName.includes('inspect') || toolName.includes('query')) {
    return 'inspection';
  } else if (toolName.includes('connection') || toolName.includes('command')) {
    return 'control';
  }
  return 'core';
}

function extractTags(toolName) {
  const tags = [];
  const words = toolName.replace('hev_', '').split('_');
  words.forEach(word => {
    if (word.length > 3 && !['show', 'list', 'tool', 'file'].includes(word)) {
      tags.push(word);
    }
  });
  return tags.slice(0, 3);
}

/**
 * Generate metadata block
 */
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
    const useCases = metadata.useCases.map(uc => `'${uc.replace(/'/g, "\\'")}' `).join(', ');
    lines.push(`      useCases: [${useCases}],`);
  }
  
  if (metadata.relatedTools && metadata.relatedTools.length > 0) {
    lines.push(`      relatedTools: [${metadata.relatedTools.map(t => `'${t}'`).join(', ')}],`);
  }
  
  if (metadata.agentGuidance) {
    lines.push(`      agentGuidance: '${metadata.agentGuidance.replace(/'/g, "\\'")}',`);
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

console.log('🚀 Batch Metadata Adder\n');
console.log('Strategy: Templates + Inference Rules');
console.log('Target: 94 tools\n');
console.log('Templates available:', Object.keys(METADATA_TEMPLATES).length);
console.log('Inference: Auto-detect from tool name patterns\n');

export { METADATA_TEMPLATES, inferMetadata, generateMetadataBlock };

