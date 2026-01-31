# 🎯 Next Session Instructions: Complete Tool Metadata

> **Session Goal:** 93 tool'a metadata ekleyerek %100 metadata coverage'a ulaşmak
> **Estimated Time:** 17-22 iterations
> **Complexity:** Medium (batch processing with review)

---

## 📋 Session Başlangıcı

### 1. Hazırlık (1-2 iteration)

```bash
# MCP health check
hev_mcp_health()
# Expected: 99 tools, 6 with metadata

# Mevcut durumu analiz et
node -e "
import('./mcp-server/dist/core/tools-list.js').then(m => {
  const tools = m.getAllToolDefinitions();
  const withoutMeta = tools.filter(t => !t.metadata);
  console.log('Without metadata:', withoutMeta.length);
  console.log('\nBy category:');
  
  const byCategory = {};
  withoutMeta.forEach(t => {
    const cat = t.name.startsWith('hev_fs_') ? 'filesystem' :
                t.name.startsWith('hev_dev_') ? 'development' :
                t.name.startsWith('hev_context_') ? 'context' :
                t.name.startsWith('hev_git_') ? 'git' :
                t.name.startsWith('hev_web_') ? 'web' :
                t.name.startsWith('hev_run_') ? 'workflow' :
                t.name.includes('provider') ? 'provider' : 'electron';
    
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t.name);
  });
  
  Object.entries(byCategory).forEach(([cat, tools]) => {
    console.log(`  ${cat}: ${tools.length} tools`);
  });
});
"
```

---

## 🎯 Strateji: Category-Based Batch Processing

### Öncelik Sırası

1. **Filesystem Tools (26 tools)** - 4-5 iteration
   - En çok kullanılan kategori
   - Templates hazır (`scripts/add-metadata-batch.js`)
   - Priority: HIGH

2. **Development Tools (31 tools)** - 6-8 iteration
   - TypeScript, ESLint, refactoring tools
   - Karmaşık metadata gerekebilir
   - Priority: HIGH

3. **Electron/CDP Tools (20 tools)** - 4-5 iteration
   - UI interaction, debugging
   - Priority: MEDIUM

4. **Other Categories (16 tools)** - 3-4 iteration
   - Git (4), Web (3), Context (4), Provider (4), Workflow (1)
   - Priority: MEDIUM

---

## 🔧 Kullanılacak Tool

### `npm run tool:register` - Interactive Mode

**Kullanım:**
```bash
# Interactive full mode
npm run tool:register

# Quick mode (inference only)
npm run tool:register --quick <tool_name> "<description>"
```

**Workflow:**
1. Tool name + description gir
2. Metadata interaktif topla (category, priority, use cases, etc.)
3. Tool definition generate edilir (with metadata)
4. Kopyala → ilgili dosyaya yapıştır
5. Build & docs generate

---

## 📝 Örnek Workflow (Filesystem - 5 Tool Batch)

### Iteration 1: Hazırlık
```typescript
// List filesystem tools without metadata
const fsTools = [
  'hev_fs_open_files',
  'hev_fs_create_file',
  'hev_fs_delete_file',
  'hev_fs_move_file',
  'hev_fs_expand_folder'
];
```

### Iteration 2-3: İlk 3 Tool'a Metadata
```bash
# Tool 1
npm run tool:register --quick hev_fs_open_files "Open multiple files"
# Copy generated definition

# Tool 2
npm run tool:register --quick hev_fs_create_file "Create new file"

# Tool 3
npm run tool:register --quick hev_fs_delete_file "Delete file (recoverable)"
```

### Iteration 4: Build & Test
```bash
cd mcp-server && npm run build
node scripts/generate-tool-docs.js

# Verify
node -e "import('./mcp-server/dist/core/tools-list.js').then(m => {
  const tools = m.getAllToolDefinitions();
  const withMeta = tools.filter(t => t.metadata);
  console.log('With metadata:', withMeta.length, '/', tools.length);
})"
```

### Iteration 5: Review & Adjust
```typescript
// Review generated metadata in docs
grep -A 15 "hev_fs_open_files" .rovo/_metadata/TOOL-LIST.md

// If needed, adjust metadata
hev_fs_show({ file_path: 'mcp-server/tools/filesystem-tools.ts' })
// Edit if needed
```

---

## 🎨 Metadata Template (Reference)

```typescript
metadata: {
  category: 'filesystem',              // Required
  subcategory: 'basic-io',             // Optional
  priority: 'high',                    // critical/high/medium/low
  complexity: 'simple',                // simple/medium/complex
  useCases: [                          // Use cases list
    'Open multiple files',
    'Quick overview'
  ],
  relatedTools: [                      // Related tools
    'hev_fs_show',
    'hev_fs_grep'
  ],
  agentGuidance: 'Use for...',         // AI agent hints
  requiresConfirmation: false,         // User approval needed?
  riskLevel: 'low',                    // low/medium/high
  tags: ['read', 'multiple', 'files']  // Searchable tags
}
```

---

## ✅ Success Criteria

**Per Batch (5-10 tools):**
- ✅ All tools have metadata
- ✅ Build successful (no TypeScript errors)
- ✅ Documentation generated
- ✅ Metadata reviewed (spot check 2-3 tools)

**End of Session:**
- ✅ 99 tools with metadata (100%)
- ✅ Documentation complete
- ✅ All categories covered
- ✅ Committed & pushed

---

## 🚨 Common Issues & Solutions

### Issue 1: Tool Definition Too Long
**Problem:** Generated definition has 700+ lines  
**Solution:** Break into smaller chunks, or use bash to append

### Issue 2: Duplicate Warnings
**Problem:** Similar metadata structures flagged  
**Solution:** Ignore warnings if false positives (common with `tags: []`)

### Issue 3: Inference Wrong
**Problem:** Auto-inferred metadata incorrect  
**Solution:** Use interactive mode or manually adjust after generation

### Issue 4: Build Fails After Metadata Addition
**Problem:** Syntax error in metadata  
**Solution:** `hev_dev_check_syntax` before build

---

## 📊 Progress Tracking

### Use Todo List

```typescript
update_todo({
  merge: false,
  todos: [
    { id: 1, content: 'Filesystem tools (26)', status: 'pending' },
    { id: 2, content: 'Development tools (31)', status: 'pending' },
    { id: 3, content: 'Electron tools (20)', status: 'pending' },
    { id: 4, content: 'Other categories (16)', status: 'pending' },
    { id: 5, content: 'Final docs & commit', status: 'pending' }
  ]
});
```

### Update After Each Batch

```typescript
update_todo({
  merge: true,
  todos: [
    { id: 1, status: 'completed', content: 'Filesystem tools (26/26)' }
  ]
});
```

---

## 🎯 Efficiency Tips

### 1. Batch Processing
```bash
# Process 5 tools at once
for tool in tool1 tool2 tool3 tool4 tool5; do
  npm run tool:register --quick $tool "Description"
done
```

### 2. Template Reuse
```typescript
// Similar tools can reuse metadata structure
// e.g., All 'read' operations: priority=medium, riskLevel=low
```

### 3. Spot Check, Not Full Review
```bash
# Don't review all 93 tools individually
# Spot check 2-3 per category (10-15 total)
```

### 4. Commit Frequently
```bash
# After each category completion
git add -A
git commit -m "feat: Add metadata to filesystem tools (26/93)"
```

---

## 📈 Expected Timeline

**Optimistic (17 iterations):**
- Filesystem: 4 iterations (fast, templates ready)
- Development: 6 iterations (many tools)
- Electron: 4 iterations (straightforward)
- Others: 3 iterations (small)

**Realistic (20 iterations):**
- Filesystem: 5 iterations
- Development: 7 iterations
- Electron: 5 iterations
- Others: 3 iterations

**Pessimistic (22 iterations):**
- Filesystem: 5 iterations
- Development: 8 iterations
- Electron: 5 iterations
- Others: 4 iterations

---

## 🎊 Final Deliverables

1. **99 Tools with Metadata** (100% coverage)
2. **Updated Documentation** (auto-generated)
3. **Committed & Pushed** (clean git history)
4. **Notebook Updated** (lessons learned)

---

## 💡 Alternative: Hybrid Approach

**If time is limited, prioritize critical tools:**

**Phase A: High Priority (30 tools)** - 7-8 iterations
- All filesystem basic-io tools
- All development critical tools
- Top 5 electron tools

**Phase B: Remaining (63 tools)** - Next session
- Lower priority categories
- Batch with less review

---

## 📞 Need Help?

**Reference Files:**
- `scripts/register-tool.js` - Interactive helper
- `scripts/add-metadata-batch.js` - Inference rules
- `.rovo/notebook.md` - Previous session notes
- `.rovo/01-AGENTS.md` - Tool usage guide

**Key Commands:**
```bash
npm run tool:register          # Interactive mode
npm run docs:generate          # Generate docs
hev_dev_check_syntax           # Validate syntax
hev_mcp_health                 # Check tool count
```

---

**Session Start Checklist:**
- [ ] Read this file completely
- [ ] Run `hev_mcp_health()` to verify system
- [ ] Analyze current state (6/99 with metadata)
- [ ] Create todo list for tracking
- [ ] Start with filesystem category
- [ ] Commit after each category

**Good luck! 🚀**

---
**Created:** 2026-01-31  
**For Session:** Metadata Completion (Phase 3.3-3.6)  
**Estimated Duration:** 2-3 hours  
**Complexity:** Medium  
