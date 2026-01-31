# 🎯 Next Session Instructions: Complete Tool Metadata

**STATUS:** 🟢 40% COMPLETE (37/93+ tools done)  
**PRIORITY:** HIGH  
**ESTIMATED TIME:** 2-3 hours remaining  
**LAST UPDATE:** 2026-01-31

---

## 📊 Progress Summary

### ✅ COMPLETED (37 tools - 8 categories)

1. **Debug/Log Tools (5)** ✅
   - hev_read_electron_logs, hev_list_log_sessions, hev_get_error_hints
   - hev_get_session_summary, hev_collect_error_context
   - File: `mcp-server/core/tools-registry.ts`

2. **CDP Tools (12)** ✅
   - Connection: hev_check_electron_connection, hev_test_electron
   - Interaction: hev_click_element_by_selector, hev_click_element_by_text, hev_fill_input_field, hev_send_key_press
   - Inspection: hev_inspect_element, hev_query_elements, hev_get_page_dom_structure
   - Visual: hev_take_cdp_screenshot, hev_get_electron_window_info, hev_scroll_page
   - File: `mcp-server/core/tools-registry.ts`

3. **Tool Discovery (2)** ✅
   - hev_suggest_tool, hev_tool_workflow
   - File: `mcp-server/tools/tool-discovery.ts`

4. **Provider Tools (4)** ✅
   - hev_list_provider_webviews, hev_list_provider_selectors
   - hev_validate_provider_selectors, hev_inspect_provider_element
   - File: `mcp-server/tools/provider-tools.ts`

5. **Workflow Tools (3)** ✅
   - hev_run_workflow, hev_run_steps, hev_list_workflows
   - File: `mcp-server/tools/workflow-tools.ts`

6. **Git Tools (4)** ✅
   - hev_git_fork_setup, hev_git_create_pr
   - hev_git_check_guidelines, hev_git_pr_status
   - File: `mcp-server/tools/git-tools.ts`

7. **Context Tools (4)** ✅
   - hev_context_generate, hev_context_status
   - hev_context_module, hev_context_read
   - File: `mcp-server/tools/context-tools.ts`

8. **Web Tools (3)** ✅
   - hev_web_search, hev_web_fetch, hev_web_search_and_fetch
   - File: `mcp-server/tools/web-tools.ts`

---

## ⏳ REMAINING (56+ tools - 2 categories)

### 9. **Filesystem Tools (21 tools)** ⬅️ START HERE
**File:** `mcp-server/tools/filesystem-tools.ts` (1184 lines)
**Status:** 0/21 done

**Subcategories:**
- **Basic IO (4):** hev_fs_open_files, hev_fs_create_file, hev_fs_delete_file, hev_fs_move_file
- **Code Operations (4):** hev_fs_expand_code_chunks, hev_fs_find_and_replace, hev_fs_grep, hev_fs_show
- **Navigation (1):** hev_fs_expand_folder
- **Execution (1):** hev_fs_bash
- **Planning (1):** hev_fs_create_plan
- **Trash/Recovery (3):** hev_fs_trash_list, hev_fs_restore, hev_fs_trash_empty
- **History (3):** hev_fs_backup, hev_fs_undo, hev_fs_history
- **Diff (2):** hev_fs_diff, hev_fs_diff_content
- **Chunked (2):** hev_fs_create_chunked, hev_fs_append_chunk

**Priority Tools (add first):**
1. hev_fs_show (CRITICAL - used before all edits)
2. hev_fs_find_and_replace (HIGH - most used edit tool)
3. hev_fs_bash (HIGH - versatile execution)
4. hev_fs_grep (HIGH - search operations)
5. hev_fs_open_files (MEDIUM)

### 10. **Dev Tools (~40 tools)** ⬅️ FINAL CATEGORY
**Location:** `mcp-server/tools/dev/*.ts` (multiple files)
**Status:** 0/40 done

**Subcategories:**
- TypeScript suite (5-7 tools): typescript-batch-fixer.ts, typescript-dashboard.ts, typescript-type-helper.ts
- ESLint suite (5-7 tools): eslint-dashboard.ts, eslint-batch-fix.ts, eslint-project.ts
- Code editing (5-7 tools): line-editor.ts, ast-code-inserter.ts, smart-search-insert.ts
- Refactoring (3-5 tools): safe-batch-refactor.ts
- Analysis (5-7 tools): project-analyzer.ts, structure-visualizer.ts, symbol-searcher.ts
- Testing (2-3 tools): test-runner.ts
- Others (10+ tools): Various dev utilities

**Strategy for Dev Tools:**
- Bu kategori çok büyük ve karmaşık
- Alt kategorilere böl (TypeScript, ESLint, Refactor, etc.)
- Her alt kategoriyi ayrı handle et
- Toplu metadata ekleme için pattern kullan

---

## 🚀 Next Session Action Plan

### Phase 1: Filesystem Tools (10-15 iterations)
```bash
# 1. Dosyayı aç
open_files(["mcp-server/tools/filesystem-tools.ts"])

# 2. Priority toollardan başla (5 tool)
# - hev_fs_show, hev_fs_find_and_replace, hev_fs_bash, hev_fs_grep, hev_fs_open_files

# 3. Geri kalan 16 tool'u subcategory'lere göre grup grup ekle
# - Basic IO (4)
# - Trash/History (6)
# - Diff/Chunked (4)
# - Other (2)
```

### Phase 2: Dev Tools (20-25 iterations)
```bash
# 1. Alt dosyaları tespit et
ls mcp-server/tools/dev/*.ts

# 2. Her dosyayı aç ve tool sayısını say
# 3. Öncelikli toolları belirle (TypeScript, ESLint)
# 4. Kategori kategori metadata ekle
```

---

## 📝 Metadata Template

```typescript
metadata: {
  category: 'filesystem' | 'development' | 'electron' | ...,
  subcategory: 'basic-io' | 'typescript' | 'cdp' | ...,
  priority: 'critical' | 'high' | 'medium' | 'low',
  complexity: 'simple' | 'medium' | 'complex',
  useCases: ['Use case 1', 'Use case 2', ...],
  relatedTools: ['tool1', 'tool2', ...],
  agentGuidance: 'Short guidance for AI agents...',
  requiresConfirmation: true | false,
  riskLevel: 'low' | 'medium' | 'high',
  tags: ['tag1', 'tag2', ...]
}
```

---

## ✅ Verification Commands

```bash
# Tool count check
cd mcp-server && grep "metadata:" tools/*.ts core/*.ts | wc -l

# Category completion
cd mcp-server && grep "category: 'filesystem'" tools/filesystem-tools.ts | wc -l
cd mcp-server && grep "category: 'development'" tools/dev/*.ts | wc -l

# Final verification
cd mcp-server && node -e "
import('./dist/core/tools-list.js').then(m => {
  const tools = m.getAllToolDefinitions();
  const withMeta = tools.filter(t => t.metadata);
  const withoutMeta = tools.filter(t => !t.metadata);
  console.log('✅ With metadata:', withMeta.length);
  console.log('❌ Without metadata:', withoutMeta.length);
  console.log('📊 Progress:', Math.round(withMeta.length / tools.length * 100) + '%');
});
"
```

---

## 🎯 Success Criteria

- [ ] All filesystem tools (21) have metadata
- [ ] All dev tools (~40) have metadata
- [ ] Total metadata coverage: 100% (93+ tools)
- [ ] No tool definition without metadata property
- [ ] All metadata follows the standard schema

---

## 📚 Reference

**Completed Files:**
- ✅ mcp-server/core/tools-registry.ts (Debug/Log + CDP tools)
- ✅ mcp-server/tools/tool-discovery.ts
- ✅ mcp-server/tools/provider-tools.ts
- ✅ mcp-server/tools/workflow-tools.ts
- ✅ mcp-server/tools/git-tools.ts
- ✅ mcp-server/tools/context-tools.ts
- ✅ mcp-server/tools/web-tools.ts

**Remaining Files:**
- ⏳ mcp-server/tools/filesystem-tools.ts (21 tools)
- ⏳ mcp-server/tools/dev/*.ts (~40 tools, multiple files)

---

**Last Session:** 2026-01-31 (29 iterations used, 37 tools completed)
**Next Session:** Continue with Filesystem Tools
