#!/usr/bin/env node
/**
 * sync-agents-version.js
 * 
 * Synchronizes version info across all AGENTS.md files
 * Prevents version drift and outdated metadata
 * 
 * Usage: node scripts/sync-agents-version.js
 */

const fs = require('fs');
const path = require('path');

// === CONFIG ===
const AGENTS_FILES = [
  'AGENTS.md',
  '.rovo/01-AGENTS.md',
  'mcp-server/AGENTS.md'
];

const VERSION_INFO = {
  app_version: '5.5.0',
  mcp_version: '1.12.0',
  tool_count: 77,
  last_updated: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  maintainer: 'ROVO AI Agent'
};

// === FOOTER TEMPLATES ===
const FOOTER_TEMPLATES = {
  'AGENTS.md': `
**Last Updated:** ${VERSION_INFO.last_updated}  
**Version:** ${VERSION_INFO.app_version}  
**MCP Version:** ${VERSION_INFO.mcp_version}  
**Tools:** ${VERSION_INFO.tool_count}  
**Maintained by:** ${VERSION_INFO.maintainer}
`,
  '.rovo/01-AGENTS.md': `
**Last Updated:** ${VERSION_INFO.last_updated}  
**Version:** 3.0 (Simplified)  
**Status:** ✅ Production Ready  
**Maintained by:** ${VERSION_INFO.maintainer}
`,
  'mcp-server/AGENTS.md': `
**Last Updated:** ${VERSION_INFO.last_updated}  
**Maintainer:** ${VERSION_INFO.maintainer}  
**Status:** ✅ Production Ready
`
};

// === MAIN LOGIC ===
function updateAgentsFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  
  // Find footer section (starts with "---" followed by "**Last Updated:**")
  let footerStartIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '---' && i < lines.length - 2 && lines[i + 2].startsWith('**Last Updated:**')) {
      footerStartIndex = i;
      break;
    }
  }

  if (footerStartIndex === -1) {
    console.warn(`⚠️  Footer not found in ${filePath}, appending new footer`);
    content += '\n---\n' + FOOTER_TEMPLATES[filePath];
  } else {
    // Replace footer
    const beforeFooter = lines.slice(0, footerStartIndex).join('\n');
    content = beforeFooter + '\n---' + FOOTER_TEMPLATES[filePath];
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ Updated: ${filePath}`);
  return true;
}

function main() {
  console.log('🔄 Syncing AGENTS.md versions...\n');
  
  let successCount = 0;
  for (const file of AGENTS_FILES) {
    if (updateAgentsFile(file)) {
      successCount++;
    }
  }

  console.log(`\n📊 Summary: ${successCount}/${AGENTS_FILES.length} files updated`);
  console.log(`\n📦 Version Info:`);
  console.log(`   App: ${VERSION_INFO.app_version}`);
  console.log(`   MCP: ${VERSION_INFO.mcp_version}`);
  console.log(`   Tools: ${VERSION_INFO.tool_count}`);
  console.log(`   Date: ${VERSION_INFO.last_updated}`);
}

if (require.main === module) {
  main();
}

module.exports = { updateAgentsFile, VERSION_INFO };
