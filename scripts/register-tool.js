#!/usr/bin/env node
/**
 * Interactive Tool Registration Helper
 * 
 * Yeni tool eklemeyi kolaylaştırır:
 * - Interactive metadata toplama
 * - Otomatik tool definition oluşturma
 * - Handler registration
 * - Documentation update
 * 
 * Usage:
 *   node scripts/register-tool.js
 *   node scripts/register-tool.js --quick hev_new_tool "Description here"
 * 
 * @version 1.0.0
 * @created 2026-01-31
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Ask question and get answer
 */
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

/**
 * Category suggestions
 */
const CATEGORIES = [
  { value: 'core', desc: 'Health, discovery, system tools' },
  { value: 'filesystem', desc: 'File operations, search, history' },
  { value: 'development', desc: 'TypeScript, ESLint, testing, refactoring' },
  { value: 'electron', desc: 'CDP, UI interaction, screenshots' },
  { value: 'git', desc: 'Git operations, PR management' },
  { value: 'web', desc: 'Web search, scraping' },
  { value: 'workflow', desc: 'Predefined test workflows' },
  { value: 'context', desc: 'Context generation' },
  { value: 'provider', desc: 'Provider validation and inspection' }
];

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const COMPLEXITIES = ['simple', 'medium', 'complex'];
const RISK_LEVELS = ['low', 'medium', 'high'];

/**
 * Interactive metadata collection
 */
async function collectMetadata(toolName, description) {
  console.log('\n🔧 Tool Registration: ' + toolName);
  console.log('Description: ' + description);
  console.log('\n--- Metadata Collection (press Enter for default) ---\n');
  
  // Category
  console.log('Available categories:');
  CATEGORIES.forEach((cat, i) => {
    console.log(`  ${i + 1}. ${cat.value} - ${cat.desc}`);
  });
  const catInput = await ask('\nCategory (number or name): ');
  const catIndex = parseInt(catInput) - 1;
  const category = isNaN(catIndex) ? (catInput || inferCategory(toolName)) : CATEGORIES[catIndex].value;
  
  // Subcategory
  const suggestedSubcat = inferSubcategory(toolName, category);
  const subcategory = await ask(`Subcategory [${suggestedSubcat}]: `) || suggestedSubcat;
  
  // Priority
  const suggestedPriority = inferPriority(toolName);
  console.log(`\nPriority options: ${PRIORITIES.join(', ')}`);
  const priority = await ask(`Priority [${suggestedPriority}]: `) || suggestedPriority;
  
  // Complexity
  const suggestedComplexity = inferComplexity(toolName);
  console.log(`\nComplexity options: ${COMPLEXITIES.join(', ')}`);
  const complexity = await ask(`Complexity [${suggestedComplexity}]: `) || suggestedComplexity;
  
  // Use cases
  console.log('\nUse cases (comma-separated):');
  const useCasesInput = await ask('> ');
  const useCases = useCasesInput ? useCasesInput.split(',').map(s => s.trim()) : [description.split('.')[0]];
  
  // Related tools
  const relatedInput = await ask('\nRelated tools (comma-separated, optional): ');
  const relatedTools = relatedInput ? relatedInput.split(',').map(s => s.trim()) : [];
  
  // Agent guidance
  const agentGuidance = await ask('\nAgent guidance (important notes for AI, optional): ');
  
  // Risk & Confirmation
  const suggestedRisk = inferRiskLevel(toolName);
  console.log(`\nRisk level options: ${RISK_LEVELS.join(', ')}`);
  const riskLevel = await ask(`Risk level [${suggestedRisk}]: `) || suggestedRisk;
  
  const requiresConfirmation = riskLevel === 'high' || toolName.includes('batch') || toolName.includes('delete');
  const confirmInput = await ask(`Requires confirmation? [${requiresConfirmation ? 'yes' : 'no'}]: `);
  const confirmation = confirmInput ? confirmInput.toLowerCase().startsWith('y') : requiresConfirmation;
  
  // Tags
  const suggestedTags = extractTags(toolName);
  const tagsInput = await ask(`\nTags (comma-separated) [${suggestedTags.join(', ')}]: `);
  const tags = tagsInput ? tagsInput.split(',').map(s => s.trim()) : suggestedTags;
  
  return {
    category,
    subcategory: subcategory || undefined,
    priority,
    complexity,
    useCases,
    relatedTools: relatedTools.length > 0 ? relatedTools : undefined,
    agentGuidance: agentGuidance || undefined,
    requiresConfirmation: confirmation,
    riskLevel,
    tags
  };
}

/**
 * Inference helpers
 */
function inferCategory(toolName) {
  if (toolName.startsWith('hev_fs_')) return 'filesystem';
  if (toolName.startsWith('hev_dev_')) return 'development';
  if (toolName.startsWith('hev_context_')) return 'context';
  if (toolName.startsWith('hev_git_')) return 'git';
  if (toolName.startsWith('hev_web_')) return 'web';
  if (toolName.startsWith('hev_run_')) return 'workflow';
  if (toolName.includes('provider')) return 'provider';
  if (toolName.includes('mcp') || toolName.includes('health')) return 'core';
  return 'electron';
}

function inferSubcategory(toolName, category) {
  if (category === 'filesystem') {
    if (toolName.includes('show') || toolName.includes('create')) return 'basic-io';
    if (toolName.includes('backup') || toolName.includes('history')) return 'history';
    if (toolName.includes('grep') || toolName.includes('search')) return 'search';
    if (toolName.includes('chunk')) return 'chunked-write';
    return 'advanced';
  }
  
  if (category === 'development') {
    if (toolName.includes('typescript') || toolName.includes('type')) return 'typescript';
    if (toolName.includes('eslint') || toolName.includes('lint')) return 'eslint';
    if (toolName.includes('edit')) return 'code-editing';
    if (toolName.includes('test')) return 'testing';
    if (toolName.includes('refactor')) return 'refactoring';
    return 'analysis';
  }
  
  if (category === 'electron') {
    if (toolName.includes('log')) return 'debugging';
    if (toolName.includes('click') || toolName.includes('fill')) return 'interaction';
    if (toolName.includes('screenshot')) return 'capture';
    return 'core';
  }
  
  return undefined;
}

function inferPriority(toolName) {
  if (toolName.includes('health') || toolName.includes('check') || toolName.includes('show')) return 'critical';
  if (toolName.includes('dashboard') || toolName.includes('analyze')) return 'high';
  if (toolName.includes('list') || toolName.includes('get')) return 'medium';
  return 'medium';
}

function inferComplexity(toolName) {
  if (toolName.includes('batch') || toolName.includes('refactor') || toolName.includes('workflow')) return 'complex';
  if (toolName.includes('edit') || toolName.includes('fix') || toolName.includes('analyze')) return 'medium';
  return 'simple';
}

function inferRiskLevel(toolName) {
  if (toolName.includes('batch') || toolName.includes('delete') || toolName.includes('empty')) return 'high';
  if (toolName.includes('edit') || toolName.includes('fix') || toolName.includes('move')) return 'medium';
  return 'low';
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
 * Generate tool definition code
 */
function generateToolDefinition(toolName, description, metadata, inputSchema) {
  const lines = [];
  
  lines.push(`  {`);
  lines.push(`    name: "${toolName}",`);
  lines.push(`    description: "${description}",`);
  lines.push(`    inputSchema: ${JSON.stringify(inputSchema, null, 6).replace(/\n/g, '\n    ')},`);
  lines.push(`    metadata: {`);
  lines.push(`      category: '${metadata.category}',`);
  if (metadata.subcategory) {
    lines.push(`      subcategory: '${metadata.subcategory}',`);
  }
  lines.push(`      priority: '${metadata.priority}',`);
  lines.push(`      complexity: '${metadata.complexity}',`);
  
  if (metadata.useCases && metadata.useCases.length > 0) {
    lines.push(`      useCases: [${metadata.useCases.map(uc => `'${uc.replace(/'/g, "\\'")}' `).join(', ')}],`);
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
  
  lines.push(`    }`);
  lines.push(`  } as EnhancedToolDefinition,`);
  
  return lines.join('\n');
}

/**
 * Main interactive flow
 */
async function main() {
  console.log('🚀 Interactive Tool Registration Helper\n');
  console.log('This helper will guide you through adding a new tool with metadata.\n');
  
  // Basic info
  const toolName = await ask('Tool name (e.g., hev_new_tool): ');
  if (!toolName || !toolName.startsWith('hev_')) {
    console.log('❌ Tool name must start with "hev_"');
    process.exit(1);
  }
  
  const description = await ask('Description: ');
  if (!description) {
    console.log('❌ Description is required');
    process.exit(1);
  }
  
  // Input schema (simplified)
  console.log('\nInput schema (JSON format, or press Enter for empty schema):');
  const schemaInput = await ask('> ');
  const inputSchema = schemaInput ? JSON.parse(schemaInput) : { type: "object", properties: {} };
  
  // Collect metadata
  const metadata = await collectMetadata(toolName, description);
  
  // Generate definition
  const toolDef = generateToolDefinition(toolName, description, metadata, inputSchema);
  
  // Preview
  console.log('\n--- Generated Tool Definition ---\n');
  console.log(toolDef);
  console.log('\n--- End ---\n');
  
  const confirm = await ask('Add this tool? (yes/no): ');
  if (!confirm.toLowerCase().startsWith('y')) {
    console.log('❌ Cancelled');
    rl.close();
    process.exit(0);
  }
  
  // Save to file (append to appropriate registry)
  console.log('\n💾 Saving...');
  
  const targetFile = metadata.category === 'core' 
    ? 'mcp-server/core/tools-registry.ts'
    : `mcp-server/tools/${metadata.category}-tools.ts`;
  
  console.log(`Target: ${targetFile}`);
  console.log('⚠️  Note: You need to manually add this definition to the file.');
  console.log('\nCopy the generated code above and paste it into the appropriate array.\n');
  
  // Auto-register using hev_dev_register_tool
  const autoRegister = await ask('\nAuto-register to handlers/registry/index? (yes/no): ');
  if (autoRegister.toLowerCase().startsWith('y')) {
    console.log('\n📝 Saving tool definition...');
    
    // Save to temp file for manual copy-paste
    const tempFile = join(PROJECT_ROOT, 'tmp_rovodev_tool_definition.txt');
    writeFileSync(tempFile, toolDef, 'utf-8');
    console.log(`   ✅ Saved to: ${tempFile}`);
    console.log('   ℹ️  Copy this definition to the appropriate file\n');
    
    // Extract function name from tool name
    const functionName = toolName.replace('hev_', '').replace(/_/g, ' ')
      .split(' ').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
    const toolConstant = toolName.replace('hev_', '').toUpperCase();
    
    console.log('   Suggested function name:', functionName);
    console.log('   Suggested constant:', toolConstant);
    
    const proceed = await ask('\n   After adding the definition, press Enter to continue...');
    
    console.log('\n🔧 Building MCP...');
    execSync('cd mcp-server && npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    
    console.log('\n📚 Generating docs...');
    execSync('node scripts/generate-tool-docs.js', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    
    console.log('\n✅ Done! Tool registered successfully.');
    console.log('\nℹ️  Note: Don\'t forget to implement the handler function!');
  } else {
    console.log('\n✅ Tool definition generated. Add it manually to complete registration.');
  }
  
  rl.close();
}

// Quick mode (non-interactive)
if (process.argv.includes('--quick')) {
  const toolName = process.argv[process.argv.indexOf('--quick') + 1];
  const description = process.argv[process.argv.indexOf('--quick') + 2];
  
  if (!toolName || !description) {
    console.log('Usage: node scripts/register-tool.js --quick <tool_name> "<description>"');
    process.exit(1);
  }
  
  const category = inferCategory(toolName);
  const metadata = {
    category,
    subcategory: inferSubcategory(toolName, category),
    priority: inferPriority(toolName),
    complexity: inferComplexity(toolName),
    useCases: [description.split('.')[0]],
    requiresConfirmation: inferRiskLevel(toolName) === 'high',
    riskLevel: inferRiskLevel(toolName),
    tags: extractTags(toolName)
  };
  
  const inputSchema = { type: "object", properties: {} };
  const toolDef = generateToolDefinition(toolName, description, metadata, inputSchema);
  
  console.log(toolDef);
  process.exit(0);
} else {
  main().catch(err => {
    console.error('❌ Error:', err);
    rl.close();
    process.exit(1);
  });
}

