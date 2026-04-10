#!/usr/bin/env node
/* eslint-env node */
/**
 * Auto-Documentation Generator
 * 
 * Generates multi-level documentation from tool registry with metadata.
 * Single source of truth → Multiple documentation targets.
 * 
 * @version 1.0.0
 * @created 2026-01-31
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Load and parse tool definitions (tsx-based, no build needed)
 */
async function loadToolDefinitions() {
  const toolsListModule = await import('../src/mcp-server/core/tools-list.ts');
  const allTools = toolsListModule.getAllToolDefinitions();
  
  return allTools;
}

/**
 * Analyze tool definitions
 */
function analyzeTools(tools) {
  const analysis = {
    total: tools.length,
    byCategory: {},
    byPriority: {},
    byComplexity: {},
    topTools: [],
    withMetadata: [],
    withoutMetadata: [],
    requiresConfirmation: []
  };
  
  tools.forEach(tool => {
    // Category grouping
    const category = tool.metadata?.category || 'uncategorized';
    if (!analysis.byCategory[category]) {
      analysis.byCategory[category] = [];
    }
    analysis.byCategory[category].push(tool);
    
    // Priority grouping
    const priority = tool.metadata?.priority || 'medium';
    if (!analysis.byPriority[priority]) {
      analysis.byPriority[priority] = [];
    }
    analysis.byPriority[priority].push(tool);
    
    // Complexity grouping
    const complexity = tool.metadata?.complexity || 'simple';
    if (!analysis.byComplexity[complexity]) {
      analysis.byComplexity[complexity] = [];
    }
    analysis.byComplexity[complexity].push(tool);
    
    // Metadata tracking
    if (tool.metadata) {
      analysis.withMetadata.push(tool);
    } else {
      analysis.withoutMetadata.push(tool);
    }
    
    // Confirmation tracking
    if (tool.metadata?.requiresConfirmation) {
      analysis.requiresConfirmation.push(tool);
    }
  });
  
  // Top tools (critical + high priority)
  analysis.topTools = [
    ...analysis.byPriority.critical || [],
    ...analysis.byPriority.high || []
  ].sort((a, b) => {
    // Sort by priority (critical first) then by usage
    if (a.metadata?.priority === 'critical' && b.metadata?.priority !== 'critical') return -1;
    if (a.metadata?.priority !== 'critical' && b.metadata?.priority === 'critical') return 1;
    return 0;
  }).slice(0, 10);
  
  return analysis;
}

/**
 * Generate Level 1: Quick Reference (AGENTS.md root)
 */
function generateQuickReference(analysis) {
  const timestamp = new Date().toISOString().split('T')[0];
  
  let content = `# 🚀 app Quick Reference for AI Agents\n\n`;
  content += `> **📚 Full Documentation:** [.rovo/01-AGENTS.md](.rovo/01-AGENTS.md)\n`;
  content += `> **🔧 MCP Server Details:** [src/mcp-server/AGENTS.md](src/mcp-server/AGENTS.md)\n`;
  content += `> **⚡ Quick Start (5 min):** [.rovo/00-QUICK-START.md](.rovo/00-QUICK-START.md)\n\n`;
  content += `---\n\n`;
  
  // Health check
  content += `## 🎯 Always Start Here\n\n`;
  content += `\`\`\`typescript\n`;
  content += `// 1. Verify MCP is running\n`;
  content += `hev_mcp_health()\n`;
  content += `// → ✅ Should show: Healthy, v1.10.0, ${analysis.total} tools\n\n`;
  content += `// 2. Discover tools by intent\n`;
  content += `hev_suggest_tool({ intent: "TypeScript hatalarını düzelt" })\n\n`;
  content += `// 3. Follow AGENTS.md hardcoded workflows\n`;
  content += `// Workflow guidance lives in AGENTS.md\n`;
  content += `\`\`\`\n\n`;
  
  // Top 3 Critical Tools
  content += `## ⭐ TOP 3 Critical Tools\n\n`;
  const top3 = analysis.topTools.slice(0, 3);
  top3.forEach((tool, i) => {
    content += `### ${i + 1}. \`${tool.name}\`\n\n`;
    content += `${tool.description}\n\n`;
    if (tool.metadata?.agentGuidance) {
      content += `**Agent Guidance:** ${tool.metadata.agentGuidance}\n\n`;
    }
  });
  
  // Quick stats
  content += `## 📊 Quick Stats\n\n`;
  content += `- **Total Tools:** ${analysis.total}\n`;
  content += `- **With Metadata:** ${analysis.withMetadata.length}\n`;
  content += `- **Critical Priority:** ${(analysis.byPriority.critical || []).length}\n`;
  content += `- **High Priority:** ${(analysis.byPriority.high || []).length}\n`;
  content += `- **Requires Confirmation:** ${analysis.requiresConfirmation.length}\n\n`;
  
  // Emergency
  content += `## 🚨 Emergency Troubleshooting\n\n`;
  content += `| Issue | Quick Fix |\n`;
  content += `|-------|-----------|\n`;
  content += `| MCP not responding | \`hev_mcp_health()\` → Check error |\n`;
  content += `| Duplicate lines | \`git checkout -- file.ts\` |\n`;
  content += `| TypeScript errors | \`hev_dev_typescript_dashboard()\` |\n`;
  content += `| Tool overload | \`hev_suggest_tool({ intent: "..." })\` |\n\n`;
  
  content += `---\n`;
  content += `**Last Updated:** ${timestamp}\n`;
  content += `**Tool Count:** ${analysis.total}\n`;
  content += `**Generated:** Auto (scripts/generate-tool-docs.js)\n`;
  
  return content;
}

/**
 * Generate Level 2: Agent Guide (.rovo/01-AGENTS.md)
 */
function generateAgentGuide(analysis) {
  const timestamp = new Date().toISOString().split('T')[0];
  
  let content = `# 🤖 app Agent Development Guide\n\n`;
  content += `**Version:** 6.0.0 (Enhanced Tool Management System)\n`;
  content += `**Last Updated:** ${timestamp}\n`;
  content += `**Tool Count:** ${analysis.total}\n\n`;
  
  content += `---\n\n`;
  
  // TOP 10 Tools
  content += `## 🎯 TOP 10 Most Important Tools\n\n`;
  content += `These tools cover 80% of daily tasks:\n\n`;
  
  analysis.topTools.forEach((tool, i) => {
    content += `### ${i + 1}. \`${tool.name}\`\n\n`;
    content += `**Description:** ${tool.description}\n\n`;
    if (tool.metadata) {
      content += `**Priority:** ${tool.metadata.priority} | `;
      content += `**Complexity:** ${tool.metadata.complexity} | `;
      content += `**Risk:** ${tool.metadata.riskLevel}\n\n`;
      
      if (tool.metadata.useCases?.length > 0) {
        content += `**Use Cases:**\n`;
        tool.metadata.useCases.forEach(uc => {
          content += `- ${uc}\n`;
        });
        content += `\n`;
      }
      
      if (tool.metadata.agentGuidance) {
        content += `**⚠️ Agent Guidance:** ${tool.metadata.agentGuidance}\n\n`;
      }
      
      if (tool.metadata.relatedTools?.length > 0) {
        content += `**Related Tools:** ${tool.metadata.relatedTools.map(t => `\`${t}\``).join(', ')}\n\n`;
      }
    }
    content += `---\n\n`;
  });
  
  // Tool Discovery
  content += `## 🔍 Tool Discovery System\n\n`;
  content += `Don't memorize ${analysis.total} tools! Use intent-based discovery:\n\n`;
  content += `\`\`\`typescript\n`;
  content += `// What do you want to do?\n`;
  content += `hev_suggest_tool({ intent: "TypeScript hatalarını düzelt" })\n`;
  content += `// → Returns: recommended tools\n\n`;
  content += `// Step-by-step workflow guidance: AGENTS.md\n`;
  content += `\`\`\`\n\n`;
  
  // Categories Overview
  content += `## 📚 Tool Categories (${Object.keys(analysis.byCategory).length} categories)\n\n`;
  
  Object.entries(analysis.byCategory).forEach(([category, tools]) => {
    const emoji = getCategoryEmoji(category);
    content += `### ${emoji} ${category} (${tools.length} tools)\n\n`;
    
    // Show first 5 tools as examples
    tools.slice(0, 5).forEach(tool => {
      const priority = tool.metadata?.priority || 'medium';
      const icon = priority === 'critical' ? '⭐' : priority === 'high' ? '🔥' : '✅';
      content += `- ${icon} \`${tool.name}\` - ${tool.description}\n`;
    });
    
    if (tools.length > 5) {
      content += `- ...and ${tools.length - 5} more\n`;
    }
    content += `\n`;
  });
  
  // Safety Rules
  content += `## 🛡️ Safety Rules (MANDATORY)\n\n`;
  content += `### Before ANY Edit\n`;
  content += `\`\`\`typescript\n`;
  content += `❌ WRONG: hev_dev_edit_lines({ ... })\n\n`;
  content += `✅ RIGHT:\n`;
  content += `hev_fs_read({ file_path: 'file.ts', start_line: 100, end_line: 120 })\n`;
  content += `// Then edit...\n`;
  content += `hev_dev_edit_lines({ ... })\n`;
  content += `\`\`\`\n\n`;
  
  content += `### After ANY Edit\n`;
  content += `\`\`\`typescript\n`;
  content += `hev_dev_edit_lines({ ... })\n`;
  content += `hev_dev_check_syntax({ file_path: 'file.ts' })  // ← MANDATORY\n`;
  content += `\`\`\`\n\n`;
  
  // Tools Requiring Confirmation
  if (analysis.requiresConfirmation.length > 0) {
    content += `## ⚠️ Tools Requiring Confirmation\n\n`;
    content += `These tools need user approval:\n\n`;
    analysis.requiresConfirmation.forEach(tool => {
      content += `- \`${tool.name}\` (${tool.metadata?.riskLevel} risk)\n`;
    });
    content += `\n`;
  }
  
  content += `---\n`;
  content += `**Full Reference:** [src/mcp-server/AGENTS.md](../src/mcp-server/AGENTS.md)\n`;
  content += `**Tool List:** [.rovo/_metadata/TOOL-LIST.md](./_metadata/TOOL-LIST.md)\n`;
  
  return content;
}

/**
 * Get emoji for category
 */
function getCategoryEmoji(category) {
  const emojis = {
    'core': '💚',
    'filesystem': '📁',
    'development': '🔧',
    'electron': '⚡',
    'git': '🔀',
    'web': '🌐',
    'workflow': '🔄',
    'context': '📖',
    'provider': '🔌'
  };
  return emojis[category] || '🔹';
}

/**
 * Generate Level 4: Complete Tool List (.rovo/_metadata/TOOL-LIST.md)
 */
function generateCompleteToolList(analysis) {
  const timestamp = new Date().toISOString();
  
  let content = `# 🔧 Complete Tool List\n\n`;
  content += `> **Generated:** ${timestamp}\n`;
  content += `> **Total Tools:** ${analysis.total}\n`;
  content += `> **Auto-generated:** \`scripts/generate-tool-docs.js\`\n\n`;
  content += `---\n\n`;
  
  // Table of Contents
  content += `## Table of Contents\n\n`;
  Object.keys(analysis.byCategory).forEach(category => {
    content += `- [${category}](#${category.toLowerCase().replace(/\s+/g, '-')})\n`;
  });
  content += `\n---\n\n`;
  
  // All tools by category
  Object.entries(analysis.byCategory).forEach(([category, tools]) => {
    content += `## ${category} (${tools.length} tools)\n\n`;
    
    tools.forEach(tool => {
      content += `### \`${tool.name}\`\n\n`;
      content += `**Description:** ${tool.description}\n\n`;
      
      if (tool.metadata) {
        content += `**Metadata:**\n`;
        content += `- Priority: ${tool.metadata.priority}\n`;
        content += `- Complexity: ${tool.metadata.complexity}\n`;
        content += `- Risk Level: ${tool.metadata.riskLevel}\n`;
        content += `- Requires Confirmation: ${tool.metadata.requiresConfirmation ? 'Yes' : 'No'}\n\n`;
        
        if (tool.metadata.useCases?.length > 0) {
          content += `**Use Cases:**\n`;
          tool.metadata.useCases.forEach(uc => {
            content += `- ${uc}\n`;
          });
          content += `\n`;
        }
        
        if (tool.metadata.agentGuidance) {
          content += `**Agent Guidance:** ${tool.metadata.agentGuidance}\n\n`;
        }
        
        if (tool.metadata.tags?.length > 0) {
          content += `**Tags:** ${tool.metadata.tags.join(', ')}\n\n`;
        }
      }
      
      content += `---\n\n`;
    });
  });
  
  return content;
}

/**
 * Main generator
 */
async function main() {
  console.log('📄 Auto-Documentation Generator\n');
  
  // 1. Load tool definitions
  console.log('1. Loading tool definitions...');
  const tools = await loadToolDefinitions();
  console.log(`   ✅ Loaded ${tools.length} tools`);
  
  // 2. Analyze
  console.log('2. Analyzing tools...');
  const analysis = analyzeTools(tools);
  console.log(`   ✅ ${analysis.withMetadata.length} with metadata`);
  console.log(`   ⚠️  ${analysis.withoutMetadata.length} without metadata`);
  
  // 3. Generate Level 1: Quick Reference
  console.log('3. Generating Quick Reference (AGENTS.md)...');
  const quickRef = generateQuickReference(analysis);
  writeFileSync(join(PROJECT_ROOT, 'AGENTS.md'), quickRef, 'utf-8');
  console.log('   ✅ AGENTS.md');
  
  // 4. Generate Level 2: Agent Guide
  console.log('4. Generating Agent Guide (.rovo/01-AGENTS.md)...');
  const agentGuide = generateAgentGuide(analysis);
  writeFileSync(join(PROJECT_ROOT, '.rovo/01-AGENTS.md.generated'), agentGuide, 'utf-8');
  console.log('   ✅ .rovo/01-AGENTS.md.generated (review before replacing)');
  
  // 5. Generate Level 4: Complete List
  console.log('5. Generating Complete Tool List (.rovo/_metadata/TOOL-LIST.md)...');
  const toolList = generateCompleteToolList(analysis);
  writeFileSync(join(PROJECT_ROOT, '.rovo/_metadata/TOOL-LIST.md'), toolList, 'utf-8');
  console.log('   ✅ .rovo/_metadata/TOOL-LIST.md');
  
  // Summary
  console.log('\n✨ Documentation Generation Complete!\n');
  console.log('Summary:');
  console.log(`  - Total Tools: ${analysis.total}`);
  console.log(`  - With Metadata: ${analysis.withMetadata.length} (✅)`);
  console.log(`  - Without Metadata: ${analysis.withoutMetadata.length} (⚠️)`);
  console.log(`  - Critical Priority: ${(analysis.byPriority.critical || []).length}`);
  console.log(`  - High Priority: ${(analysis.byPriority.high || []).length}`);
  console.log(`\nNext Steps:`);
  console.log(`  1. Review .rovo/01-AGENTS.md.generated`);
  console.log(`  2. If OK, rename to .rovo/01-AGENTS.md`);
  console.log(`  3. Add metadata to ${analysis.withoutMetadata.length} remaining tools`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
