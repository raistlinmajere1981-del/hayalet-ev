# 🚀 Hayalet-ev Quick Reference for AI Agents

> **📚 Full Documentation:** [.rovo/01-AGENTS.md](.rovo/01-AGENTS.md)
> **🔧 MCP Server Details:** [mcp-server/AGENTS.md](mcp-server/AGENTS.md)
> **⚡ Quick Start (5 min):** [.rovo/00-QUICK-START.md](.rovo/00-QUICK-START.md)

---

## 🎯 Always Start Here

```typescript
// 1. Verify MCP is running
hev_mcp_health()
// → ✅ Should show: Healthy, v1.10.0, 99 tools

// 2. Discover tools by intent
hev_suggest_tool({ intent: "TypeScript hatalarını düzelt" })

// 3. Get workflow guide
hev_tool_workflow({ scenario: "file-edit-safe" })
```

## ⭐ TOP 3 Critical Tools

### 1. `hev_mcp_health`

Hayalet-ev MCP'nin sağlık durumunu kontrol et. Eğer bu tool çalışıyorsa, MCP aktif ve built-in override sistemi çalışıyor demektir.

**Agent Guidance:** Her session başında veya tool hatası aldığında kullan. MCP çalışmazsa built-in toollar aktif olur (RISKLI!).

### 2. `hev_suggest_tool`

AI agent'a tool önerisi yap (intent-based discovery). Ne yapmak istediğini söyle, sana en uygun toolları önerir.

**Agent Guidance:** 97 tool arasında kayboluyorsan bu tool'u kullan. Intent-based smart search.

### 3. `hev_list_tools`

Hayalet-ev MCP tool'larını kategorize ederek listele (97 tool)

**Agent Guidance:** Tüm toolları görmek yerine hev_suggest_tool veya kategori bazlı arama kullan. 97 tool çok fazla!

## 📊 Quick Stats

- **Total Tools:** 99
- **With Metadata:** 6
- **Critical Priority:** 2
- **High Priority:** 3
- **Requires Confirmation:** 0

## 🚨 Emergency Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| MCP not responding | `hev_mcp_health()` → Check error |
| Duplicate lines | `git checkout -- file.ts` |
| TypeScript errors | `hev_dev_typescript_dashboard()` |
| Tool overload | `hev_suggest_tool({ intent: "..." })` |

---
**Last Updated:** 2026-01-31
**Tool Count:** 99
**Generated:** Auto (scripts/generate-tool-docs.js)
