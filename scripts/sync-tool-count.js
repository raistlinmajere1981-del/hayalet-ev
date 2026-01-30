#!/usr/bin/env node
/**
 * Tool Count Sync Script
 * 
 * Automatically syncs tool count across all documentation files.
 * Reads from compiled MCP server and updates markdown files.
 * 
 * Usage: node scripts/sync-tool-count.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

async function getActualToolCount() {
  try {
    // Import compiled tools-list
    const toolsListPath = join(PROJECT_ROOT, 'mcp-server/dist/core/tools-list.js');
    const { getAllToolDefinitions } = await import(toolsListPath);
    
    const tools = getAllToolDefinitions();
    return {
      total: tools.length,
      tools: tools.map(t => t.name),
      categories: categorizeTool(tools)
    };
  } catch (error) {
    console.error('❌ Error reading tool definitions:', error.message);
    console.error('💡 Make sure to run: cd mcp-server && npm run build');
    process.exit(1);
  }
}

function categorizeTool(tools) {
  const categories = {
    mcp: [],
    cdp: [],
    fs: [],
    dev: [],
    context: [],
    git: [],
    web: [],
    workflow: [],
    provider: []
  };
  
  tools.forEach(t => {
    const name = t.name;
    if (name.startsWith('hev_fs_')) categories.fs.push(name);
    else if (name.startsWith('hev_dev_')) categories.dev.push(name);
    else if (name.startsWith('hev_context_')) categories.context.push(name);
    else if (name.startsWith('hev_git_')) categories.git.push(name);
    else if (name.startsWith('hev_web_')) categories.web.push(name);
    else if (name.startsWith('hev_run_')) categories.workflow.push(name);
    else if (name.includes('provider') || name.includes('validate_') || name.includes('inspect_provider')) {
      categories.provider.push(name);
    }
    else if (name.includes('electron') || name.includes('cdp') || name.includes('screenshot') || 
             name.includes('click') || name.includes('fill') || name.includes('inspect_element') ||
             name.includes('query_element') || name.includes('key_press') || name.includes('scroll') ||
             name.includes('dom_structure') || name.includes('window_info')) {
      categories.cdp.push(name);
    }
    else {
      categories.mcp.push(name);
    }
  });
  
  return {
    mcp: categories.mcp.length,
    cdp: categories.cdp.length,
    fs: categories.fs.length,
    dev: categories.dev.length,
    context: categories.context.length,
    git: categories.git.length,
    web: categories.web.length,
    workflow: categories.workflow.length,
    provider: categories.provider.length
  };
}

function updateFile(filePath, replacements) {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let changes = 0;
    
    replacements.forEach(({ pattern, replacement }) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        changes++;
      }
    });
    
    if (changes > 0) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Updated ${filePath} (${changes} changes)`);
      return true;
    } else {
      console.log(`⏭️  Skipped ${filePath} (no changes needed)`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Tool Count Sync Script\n');
  
  // Get actual tool count
  console.log('📊 Reading tool definitions...');
  const { total, categories } = await getActualToolCount();
  
  console.log(`\n✅ Found ${total} tools:`);
  Object.entries(categories).forEach(([cat, count]) => {
    if (count > 0) console.log(`   - ${cat}: ${count}`);
  });
  
  console.log('\n📝 Updating documentation files...\n');
  
  const filesToUpdate = [
    {
      path: '.rovo/_metadata/TOOL-LIST.md',
      replacements: [
        {
          pattern: /> \*\*Total Tools:\*\* \d+/g,
          replacement: `> **Total Tools:** ${total}`
        },
        {
          pattern: /> \*\*Generated:\*\* [^\n]+/g,
          replacement: `> **Generated:** ${new Date().toISOString()}`
        }
      ]
    },
    {
      path: '.rovo/01-AGENTS.md',
      replacements: [
        {
          pattern: /- \*\*MCP Server:\*\* v[\d.]+ \(\d+ tools?\)/g,
          replacement: `- **MCP Server:** v1.12.0 (${total} tools)`
        },
        {
          pattern: /- \[Tool List\]\([^)]+\) - All \d+ tools?/g,
          replacement: `- [Tool List](_metadata/TOOL-LIST.md) - All ${total} tools`
        }
      ]
    },
    {
      path: '.rovo/_metadata/VERSION-INFO.md',
      replacements: [
        {
          pattern: /"tool_count":\s*\d+/g,
          replacement: `"tool_count": ${total}`
        }
      ]
    }
  ];
  
  let totalUpdated = 0;
  
  filesToUpdate.forEach(({ path, replacements }) => {
    const fullPath = join(PROJECT_ROOT, path);
    if (updateFile(fullPath, replacements)) {
      totalUpdated++;
    }
  });
  
  console.log(`\n✨ Done! Updated ${totalUpdated}/${filesToUpdate.length} files.`);
  console.log(`📊 Total tools: ${total}`);
  
  // Summary
  console.log('\n📋 Summary:');
  console.log(`   Tool count synchronized across documentation`);
  console.log(`   Current count: ${total} tools`);
  console.log(`   Last updated: ${new Date().toISOString()}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
