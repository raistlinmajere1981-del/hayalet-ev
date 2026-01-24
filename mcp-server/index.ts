#!/usr/bin/env node

/**
 * Hayalet-ev MCP Server (Orchestrator)
 * 
 * Alt modüller:
 * - tools/electron-tools.js: Electron test ve plugin araçları
 * - tools/log-tools.js: Log okuma ve sorgulama araçları
 * - tools/debug-tools.js: Hata analizi ve debugging araçları
 * - tools/cdp-tools.js: Chrome DevTools Protocol araçları
 * - utils/log-utils.js: Log yardımcı fonksiyonları
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { testElectron, listPlugins } from "./tools/electron-tools.js";
import { readElectronLogs, listLogSessions, getSessionSummary } from "./tools/log-tools.js";
import { getErrorHints } from "./tools/debug-tools.js";
import {
  checkElectronConnection,
  sendCommandToElectron,
  takeCdpScreenshot,
  getElectronWindowInfo,
  clickElementBySelector,
  clickElementByText,
  fillInputField,
  getPageDomStructure,
  inspectElement,
  queryElements,
  sendKeyPress,
  scrollPage,
} from "./tools/cdp-tools.js";
import {
  openFiles,
  createFile,
  deleteFile,
  moveFile,
  expandCodeChunks,
  findAndReplaceCode,
  grep,
  expandFolder,
  executeBash,
  createTechnicalPlan,
  trashList,
  restoreFile,
  trashEmpty,
  backupFile,
  undoOperation,
  operationHistory,
  fileDiff,
  contentDiff,
  showFile,
  createChunkedFile,
  appendChunk,
  FILESYSTEM_TOOL_DEFINITIONS,
} from "./tools/filesystem-tools.js";
import {
  analyzeProject,
  bootstrapContext,
  generateDiagram,
  updateCache,
  editLines,
  gitDiff,
  lintFile,
  searchSymbol,
  testRun,
  DEV_TOOL_DEFINITIONS,
} from "./tools/dev-tools.js";
import {
  listProviderWebviews,
  listProviderSelectors,
  validateSelectors,
  inspectProviderElementTool,
  PROVIDER_TOOL_DEFINITIONS,
} from "./tools/provider-tools.js";

import {
  handleWebSearch,
  handleWebFetch,
  handleWebSearchAndFetch,
  webToolDefinitions,
} from "./tools/web-tools.js";
import {
  runWorkflow,
  runCustomSteps,
  listWorkflows,
  WORKFLOW_TOOL_DEFINITIONS,
} from "./tools/workflow-tools.js";
import {
  gitForkSetup,
  gitCreatePr,
  gitCheckGuidelines,
  gitPrStatus,
  GIT_TOOL_DEFINITIONS,
} from "./tools/git-tools.js";
import {
  generateContext,
  contextStatus,
  moduleContext,
  readContext,
  CONTEXT_TOOL_DEFINITIONS,
} from "./tools/context-tools.js";
import {
  logToolCall,
  logToolError,
  logError,
} from "./utils/mcp-logger.js";
import {
  setMcpServer,
  setProgressToken,
} from "./utils/progress.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const LOG_DIR = join(PROJECT_ROOT, "logs");

const server = new Server(
  {
    name: "hayalet-ev-mcp",
    version: "1.7.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Progress utility'ye server referansı ver
setMcpServer(server);

const TOOL_DEFINITIONS = [
  // === Electron & Plugin Tool'ları ===
  {
    name: "hev_test_electron",
    description: "Hayalet-ev Electron uygulamasını test et",
    inputSchema: {
      type: "object",
      properties: {
        timeout: { type: "number", description: "Test süresi (saniye), varsayılan 5", default: 5 },
      },
    },
  },
  {
    name: "hev_list_plugins",
    description: "Hayalet-ev plugin'lerini listele",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hev_read_electron_logs",
    description: "Electron console ve error loglarını oku. Gelişmiş filtreleme: source (MAIN, RENDERER, WEBVIEW-AI1, etc.), level (LOG, WARN, ERROR), içerik arama, correlation ID ile işlem takibi.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["console", "error", "all", "structured"], description: "Log tipi", default: "all" },
        tail: { type: "number", description: "Son N satırı göster (varsayılan: 50)", default: 50 },
        source: { type: "string", description: "Kaynak filtresi: MAIN, RENDERER, WEBVIEW-AI1, WEBVIEW-AI2, WEBVIEW-* (glob destekli)" },
        level: { type: "string", enum: ["LOG", "WARN", "ERROR", "DEBUG", "INFO"], description: "Log seviyesi filtresi" },
        contains: { type: "string", description: "İçerik arama (case-insensitive)" },
        correlationId: { type: "string", description: "İşlem takibi için correlation ID" },
        sessionId: { type: "string", description: "Belirli bir session'ın loglarını oku (varsayılan: en son session)" },
      },
    },
  },
  {
    name: "hev_list_log_sessions",
    description: "Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Gösterilecek maksimum session sayısı (varsayılan: 10)", default: 10 },
      },
    },
  },
  {
    name: "hev_get_error_hints",
    description: "Belirli bir hata mesajı için AI debugging ipuçları al. Bilinen hata pattern'lerini eşleştirir ve çözüm önerileri sunar.",
    inputSchema: {
      type: "object",
      properties: {
        errorMessage: { type: "string", description: "Analiz edilecek hata mesajı" },
        provider: { type: "string", description: "İlgili provider (chatgpt, gemini, grok) - dosya yolları için kullanılır" },
      },
      required: ["errorMessage"],
    },
  },
  {
    name: "hev_get_session_summary",
    description: "Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID (varsayılan: en son session)" },
      },
    },
  },

  // === CDP (Chrome DevTools Protocol) Tool'ları ===
  {
    name: "hev_check_electron_connection",
    description: "Electron uygulamasına CDP bağlantısını kontrol et. Uygulama çalışıyor mu ve debug portu açık mı?",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hev_send_command_to_electron",
    description: "Electron uygulamasında JavaScript kodu çalıştır. Herhangi bir JS expression çalıştırabilir.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Çalıştırılacak JavaScript kodu" },
        description: { type: "string", description: "Komutun ne yaptığına dair açıklama (opsiyonel)" },
      },
      required: ["command"],
    },
  },
  {
    name: "hev_take_cdp_screenshot",
    description: "Electron penceresinin ekran görüntüsünü al (CDP üzerinden, tam sayfa).",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["png", "jpeg"], description: "Görüntü formatı", default: "png" },
        quality: { type: "number", description: "JPEG kalitesi (1-100)", default: 80 },
        savePath: { type: "string", description: "Dosya kaydetme yolu (opsiyonel)" },
      },
    },
  },
  {
    name: "hev_get_electron_window_info",
    description: "Electron penceresinin boyut, pozisyon ve URL bilgilerini al.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hev_click_element_by_selector",
    description: "CSS selector ile bir elemente tıkla.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector (örn: #myButton, .btn-primary, button[type='submit'])" },
      },
      required: ["selector"],
    },
  },
  {
    name: "hev_click_element_by_text",
    description: "Metin içeriğine göre bir elemente tıkla.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Aranacak metin içeriği" },
        tagName: { type: "string", description: "Tag filtresi (button, a, div vb.)", default: "*" },
      },
      required: ["text"],
    },
  },
  {
    name: "hev_fill_input_field",
    description: "Bir input alanına değer yaz.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Input elementinin CSS selector'ı" },
        value: { type: "string", description: "Yazılacak değer" },
        clear: { type: "boolean", description: "Önce mevcut değeri temizle", default: true },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "hev_get_page_dom_structure",
    description: "Sayfanın DOM yapısını al. Debug ve element bulma için kullanışlı.",
    inputSchema: {
      type: "object",
      properties: {
        maxDepth: { type: "number", description: "Maksimum DOM derinliği", default: 3 },
      },
    },
  },
  {
    name: "hev_inspect_element",
    description: "Bir elementin detaylı bilgilerini al (boyut, pozisyon, görünürlük, içerik).",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
      },
      required: ["selector"],
    },
  },
  {
    name: "hev_query_elements",
    description: "Bir selector ile eşleşen tüm elementleri bul ve listele.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector" },
        limit: { type: "number", description: "Maksimum sonuç sayısı", default: 20 },
      },
      required: ["selector"],
    },
  },
  {
    name: "hev_send_key_press",
    description: "Klavye tuşu gönder (Enter, Escape, Tab vb.).",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Tuş adı (Enter, Escape, Tab, ArrowDown vb.)" },
        ctrl: { type: "boolean", description: "Ctrl tuşu basılı", default: false },
        alt: { type: "boolean", description: "Alt tuşu basılı", default: false },
        shift: { type: "boolean", description: "Shift tuşu basılı", default: false },
        meta: { type: "boolean", description: "Meta/Cmd tuşu basılı", default: false },
      },
      required: ["key"],
    },
  },
  {
    name: "hev_scroll_page",
    description: "Sayfada belirli bir konuma scroll yap.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Yatay scroll pozisyonu", default: 0 },
        y: { type: "number", description: "Dikey scroll pozisyonu", default: 0 },
        behavior: { type: "string", enum: ["smooth", "instant"], description: "Scroll animasyonu", default: "smooth" },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [...TOOL_DEFINITIONS, ...FILESYSTEM_TOOL_DEFINITIONS, ...DEV_TOOL_DEFINITIONS, ...PROVIDER_TOOL_DEFINITIONS, ...webToolDefinitions, ...WORKFLOW_TOOL_DEFINITIONS, ...GIT_TOOL_DEFINITIONS, ...CONTEXT_TOOL_DEFINITIONS] };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
  const { name, arguments: args } = request.params;
  
  // Progress token'ı ayarla (varsa)
  const progressToken = (request.params as { _meta?: { progressToken?: string | number } })._meta?.progressToken;
  setProgressToken(progressToken || null);
  
  const { startTime } = logToolCall(name, args);

  try {
    switch (name) {
      case "hev_test_electron":
        return await testElectron(PROJECT_ROOT, args ?? {});

      case "hev_list_plugins":
        return await listPlugins(PROJECT_ROOT);

      case "hev_read_electron_logs":
        return await readElectronLogs(LOG_DIR, args ?? {});

      case "hev_list_log_sessions":
        return await listLogSessions(LOG_DIR, args ?? {});

      case "hev_get_error_hints":
        return await getErrorHints(args ?? {});

      case "hev_get_session_summary":
        return await getSessionSummary(LOG_DIR, args ?? {});

      // === CDP Tool'ları ===
      case "hev_check_electron_connection":
        return await checkElectronConnection();

      case "hev_send_command_to_electron":
        return await sendCommandToElectron(args ?? {});

      case "hev_take_cdp_screenshot":
        return await takeCdpScreenshot(args ?? {});

      case "hev_get_electron_window_info":
        return await getElectronWindowInfo();

      case "hev_click_element_by_selector":
        return await clickElementBySelector(args ?? {});

      case "hev_click_element_by_text":
        return await clickElementByText(args ?? {});

      case "hev_fill_input_field":
        return await fillInputField(args ?? {});

      case "hev_get_page_dom_structure":
        return await getPageDomStructure(args ?? {});

      case "hev_inspect_element":
        return await inspectElement(args ?? {});

      case "hev_query_elements":
        return await queryElements(args ?? {});

      case "hev_send_key_press":
        return await sendKeyPress(args ?? {});

      case "hev_scroll_page":
        return await scrollPage(args ?? {});

      // === Filesystem Tool'ları ===
      case "hev_fs_open_files": {
        const result = await openFiles((args as { file_paths: string[] }).file_paths);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "hev_fs_create_file": {
        const result = await createFile(
          (args as { file_path: string }).file_path,
          (args as { initial_content?: string }).initial_content ?? "",
          (args as { overwrite?: boolean }).overwrite ?? false,
          PROJECT_ROOT // Büyük dosyalar için bash heredoc kullanımı
        );
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_delete_file": {
        const result = await deleteFile(
          (args as { file_path: string }).file_path,
          PROJECT_ROOT,
          (args as { permanent?: boolean }).permanent ?? false
        );
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_move_file": {
        const result = await moveFile(
          (args as { file_path: string }).file_path,
          (args as { new_path: string }).new_path
        );
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_expand_code_chunks": {
        const result = await expandCodeChunks(
          (args as { file_path: string }).file_path,
          (args as { line_ranges?: [number, number][] }).line_ranges ?? [],
          (args as { patterns?: string[] }).patterns ?? []
        );
        return { content: [{ type: "text", text: result.error || result.content }] };
      }

      case "hev_fs_find_and_replace": {
        const result = await findAndReplaceCode(
          (args as { file_path: string }).file_path,
          (args as { find: string }).find,
          (args as { replace: string }).replace
        );
        const msg = result.success 
          ? `✅ ${result.replacements} değişiklik yapıldı: ${result.file}`
          : `❌ ${result.error}`;
        return { content: [{ type: "text", text: msg }] };
      }

      case "hev_fs_grep": {
        const result = await grep(
          PROJECT_ROOT,
          (args as { content_pattern?: string }).content_pattern ?? null,
          (args as { path_glob?: string }).path_glob ?? null
        );
        const output = result.matches.map(m => `${m.file}:${m.line}: ${m.content}`).join("\n");
        return { content: [{ type: "text", text: `${result.totalMatches} eşleşme bulundu:\n\n${output}` }] };
      }

      case "hev_fs_expand_folder": {
        const result = await expandFolder(
          (args as { folder_path: string }).folder_path,
          (args as { max_depth?: number }).max_depth ?? 3
        );
        return { content: [{ type: "text", text: result.error || result.structure }] };
      }

      case "hev_fs_bash": {
        const result = await executeBash(
          (args as { command: string }).command,
          PROJECT_ROOT,
          (args as { timeout?: number }).timeout ?? 30000
        );
        let output = "";
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? "\n" : "") + `STDERR: ${result.stderr}`;
        if (result.timedOut) output += "\n⚠️ Timeout!";
        output += `\n[exit: ${result.exitCode}]`;
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_fs_create_plan": {
        const result = createTechnicalPlan((args as { plan: import("./types/index.js").TechnicalPlan }).plan);
        return { content: [{ type: "text", text: result.summary }] };
      }

      // === Recycle Bin Tools ===
      case "hev_fs_trash_list": {
        const result = trashList(PROJECT_ROOT);
        if (result.total === 0) {
          return { content: [{ type: "text", text: "🗑️ Çöp kutusu boş" }] };
        }
        let output = `🗑️ Çöp Kutusu (${result.total} dosya)\n\n`;
        result.items.forEach((item, i) => {
          output += `${i}. ${item.path} (${item.size}) - ${item.deletedAt}\n`;
        });
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_fs_restore": {
        const result = restoreFile(PROJECT_ROOT, (args as { index?: number }).index);
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_trash_empty": {
        const result = trashEmpty(PROJECT_ROOT, (args as { older_than_days?: number }).older_than_days);
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_backup": {
        const result = backupFile(PROJECT_ROOT, (args as { file_path: string }).file_path);
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_undo": {
        const result = undoOperation(PROJECT_ROOT);
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_history": {
        const result = operationHistory(PROJECT_ROOT, (args as { limit?: number }).limit ?? 20);
        if (result.operations.length === 0) {
          return { content: [{ type: "text", text: "📋 İşlem geçmişi boş" }] };
        }
        let output = `📋 Son ${result.operations.length} İşlem\n\n`;
        result.operations.forEach((op, i) => {
          const undoIcon = op.canUndo ? "↩️" : "✓";
          output += `${i + 1}. ${undoIcon} ${op.type} - ${op.timestamp}\n`;
        });
        return { content: [{ type: "text", text: output }] };
      }

      // === Diff Tools ===
      case "hev_fs_diff": {
        const result = fileDiff(
          (args as { file1: string }).file1,
          (args as { file2: string }).file2
        );
        return { content: [{ type: "text", text: result.summary }] };
      }

      case "hev_fs_diff_content": {
        const result = contentDiff(
          (args as { content1: string }).content1,
          (args as { content2: string }).content2,
          (args as { label1?: string }).label1,
          (args as { label2?: string }).label2
        );
        if (result.identical) {
          return { content: [{ type: "text", text: "✅ İçerikler aynı" }] };
        }
        return { content: [{ type: "text", text: `📊 ${result.additions} ekleme, ${result.deletions} silme\n\n${result.unified}` }] };
      }

      case "hev_fs_show": {
        const result = showFile(
          (args as { file_path: string }).file_path,
          (args as { start_line?: number }).start_line,
          (args as { end_line?: number }).end_line
        );
        return { content: [{ type: "text", text: `📄 ${result.summary.language} (${result.summary.lines} satır)\n\n${result.content}` }] };
      }

      case "hev_fs_create_chunked": {
        const result = await createChunkedFile(
          (args as { file_path: string }).file_path,
          (args as { chunks: string[] }).chunks,
          PROJECT_ROOT,
          (args as { overwrite?: boolean }).overwrite
        );
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_fs_append_chunk": {
        const result = await appendChunk(
          (args as { file_path: string }).file_path,
          (args as { content: string }).content,
          (args as { create_if_missing?: boolean }).create_if_missing
        );
        return { content: [{ type: "text", text: result.message }] };
      }

      // === Dev Tool'ları ===
      case "hev_dev_analyze_project": {
        const result = await analyzeProject(PROJECT_ROOT, args as { mode?: "summary" | "deps" | "modules" | "full" });
        let output = `📊 Proje Analizi\n\n`;
        output += `Toplam: ${result.summary.totalFiles} dosya, ${result.summary.totalLines} satır\n\n`;
        for (const [dir, stats] of Object.entries(result.summary.byDirectory)) {
          output += `- ${dir}: ${stats.files} dosya, ${stats.lines} satır\n`;
        }
        if (result.git) {
          output += `\n🔀 Git: ${result.git.branch} (${result.git.hasChanges ? "değişiklik var" : "temiz"})\n`;
        }
        if (result.dependencies) {
          output += `\n📦 Bağımlılıklar: ${result.dependencies.production.length} prod, ${result.dependencies.development.length} dev\n`;
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_dev_bootstrap_context": {
        const result = await bootstrapContext(PROJECT_ROOT, args as { print?: boolean; full?: boolean });
        return { content: [{ type: "text", text: result.content }] };
      }

      case "hev_dev_generate_diagram": {
        const result = await generateDiagram(PROJECT_ROOT, args as { format?: "mermaid" | "dot"; module?: string; depth?: number });
        return { content: [{ type: "text", text: `📊 Bağımlılık Diagramı (${result.nodeCount} modül, ${result.edgeCount} bağlantı)\n\n${result.diagram}` }] };
      }

      case "hev_dev_update_cache": {
        const result = await updateCache(PROJECT_ROOT, args as { force?: boolean; show?: boolean });
        let output = result.updated ? "✅ Cache güncellendi" : "📋 Cache durumu";
        output += `\n\nDosyalar: ${result.stats.totalFiles}\nSatırlar: ${result.stats.totalLines}\nExportlar: ${result.stats.totalExports}`;
        if (result.changedFiles.length > 0) {
          output += `\n\nDeğişen dosyalar (${result.changedFiles.length}):\n`;
          output += result.changedFiles.slice(0, 10).map(f => `- ${f}`).join("\n");
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_dev_edit_lines": {
        const result = editLines(
          (args as { file_path: string }).file_path,
          {
            operation: (args as { operation: "replace" | "delete" | "insert" | "show" }).operation,
            startLine: (args as { start_line: number }).start_line,
            endLine: (args as { end_line?: number }).end_line,
            content: (args as { content?: string }).content,
            dryRun: (args as { dry_run?: boolean }).dry_run,
          }
        );
        let output = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
        if (result.preview) output += `\n\n${result.preview}`;
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_dev_git_diff": {
        const result = gitDiff(PROJECT_ROOT, {
          staged: (args as { staged?: boolean }).staged,
          file: (args as { file?: string }).file,
        });
        let output = result.diff;
        if (result.stats) {
          output = `📊 +${result.stats.additions} -${result.stats.deletions}\n\n${output}`;
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_dev_lint_file": {
        const result = lintFile(
          PROJECT_ROOT,
          (args as { file_path: string }).file_path,
          (args as { fix?: boolean }).fix ?? false
        );
        let output = result.output;
        if (!result.success) {
          output = `❌ ${result.errorCount} hata, ${result.warningCount} uyarı\n\n${output}`;
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_dev_search_symbol": {
        const result = await searchSymbol(
          PROJECT_ROOT,
          (args as { symbol: string }).symbol,
          { type: (args as { type?: "function" | "class" | "interface" | "type" | "const" | "all" }).type }
        );
        if (result.total === 0) {
          return { content: [{ type: "text", text: `🔍 "${(args as { symbol: string }).symbol}" bulunamadı` }] };
        }
        let output = `🔍 ${result.total} sonuç bulundu\n\n`;
        for (const match of result.matches) {
          output += `📍 ${match.file}:${match.line} [${match.type}]\n   ${match.context}\n\n`;
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_dev_test_run": {
        const result = testRun(PROJECT_ROOT, {
          file: (args as { file?: string }).file,
          grep: (args as { grep?: string }).grep,
          timeout: (args as { timeout?: number }).timeout,
        });
        let output = result.output;
        const statusIcon = result.success ? "✅" : "❌";
        const summary = `${statusIcon} ${result.passed} passed, ${result.failed} failed`;
        output = `${summary}\n\n${output}`;
        return { content: [{ type: "text", text: output }] };
      }

      // === Provider Tool'ları ===
      case "hev_list_provider_webviews": {
        const result = await listProviderWebviews(PROJECT_ROOT);
        let output = "📋 Provider ve Webview Listesi\n\n";
        output += "**Providers:**\n";
        for (const p of result.providers) {
          output += `- ${p.name} (${p.id}) ${p.hasConfig ? "✅" : "❌"}\n`;
        }
        output += "\n**Bağlı Webviews:**\n";
        if (result.connected.length === 0) {
          output += "- Bağlı webview yok (Electron çalışıyor mu?)\n";
        } else {
          for (const w of result.connected) {
            output += `- ${w.provider}: ${w.title}\n  ${w.url}\n`;
          }
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_list_provider_selectors": {
        const result = listProviderSelectors(PROJECT_ROOT, (args as { provider: string }).provider);
        if (!result.found) {
          return { content: [{ type: "text", text: `❌ Provider config bulunamadı: ${result.provider}` }] };
        }
        let output = `📋 ${result.provider} Selector Listesi\n`;
        output += `URL: ${result.config?.baseUrl}\n`;
        output += `Son Doğrulama: ${result.config?.lastVerified || "Bilinmiyor"}\n`;
        output += `Toplam: ${result.summary.total} selector\n\n`;
        
        for (const [category, sels] of Object.entries(result.grouped)) {
          output += `**${category}** (${sels.length}):\n`;
          for (const sel of sels) {
            output += `  - ${sel.key}: \`${sel.selector.slice(0, 60)}${sel.selector.length > 60 ? "..." : ""}\`\n`;
          }
          output += "\n";
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_validate_provider_selectors": {
        const result = await validateSelectors(
          PROJECT_ROOT,
          (args as { provider: string }).provider,
          (args as { categories?: string[] }).categories
        );
        
        if (!result.connected) {
          return { content: [{ type: "text", text: `❌ ${result.error}` }] };
        }
        
        let output = `📊 ${result.provider} Selector Doğrulama\n`;
        output += `URL: ${result.url}\n`;
        output += `Tarih: ${result.timestamp}\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // Sonuçları kategoriye göre grupla
        const grouped: Record<string, typeof result.results> = {};
        for (const r of result.results) {
          if (!grouped[r.category]) grouped[r.category] = [];
          grouped[r.category].push(r);
        }
        
        for (const [category, results] of Object.entries(grouped)) {
          output += `**${category}:**\n`;
          for (const r of results) {
            const icon = r.found ? "✅" : "❌";
            const countInfo = r.found ? ` (${r.count} element)` : "";
            output += `${icon} ${r.key}${countInfo}\n`;
            if (!r.found && r.error) {
              output += `   Hata: ${r.error}\n`;
            }
          }
          output += "\n";
        }
        
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `Özet: ${result.summary.valid}/${result.summary.total} geçerli (${result.summary.successRate})\n`;
        
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_inspect_provider_element": {
        const result = await inspectProviderElementTool(
          PROJECT_ROOT,
          (args as { provider: string }).provider,
          (args as { selector: string }).selector,
          {
            includeStyles: (args as { include_styles?: boolean }).include_styles,
            includeParent: (args as { include_parent?: boolean }).include_parent,
            includeChildren: (args as { include_children?: boolean }).include_children,
          }
        );
        
        if (!result.found) {
          return { content: [{ type: "text", text: `❌ Element bulunamadı: ${result.selector}\n${result.error || ""}` }] };
        }
        
        let output = `📋 Element Inspect: ${result.provider}\n`;
        output += `Selector: \`${result.selector}\`\n`;
        output += `Bulunan: ${result.count} element\n\n`;
        
        for (let i = 0; i < (result.elements?.length || 0); i++) {
          const el = result.elements![i];
          output += `**Element #${i + 1}:**\n`;
          output += `  Tag: ${el.tagName}\n`;
          if (el.id) output += `  ID: ${el.id}\n`;
          if (el.className) output += `  Class: ${(el.className as string).slice(0, 80)}...\n`;
          if (el.textContent) output += `  Text: "${(el.textContent as string).slice(0, 50)}..."\n`;
          if (el.isVisible !== undefined) output += `  Görünür: ${el.isVisible ? "✅" : "❌"}\n`;
          if (el.boundingRect) {
            const rect = el.boundingRect as { x: number; y: number; width: number; height: number };
            output += `  Konum: ${rect.x}, ${rect.y} | Boyut: ${rect.width}x${rect.height}\n`;
          }
          if (el.attributes) {
            const attrs = Object.entries(el.attributes as Record<string, string>).slice(0, 5);
            if (attrs.length > 0) {
              output += `  Attributes:\n`;
              for (const [k, v] of attrs) {
                output += `    ${k}="${(v as string).slice(0, 40)}"\n`;
              }
            }
          }
          output += "\n";
        }
        
        return { content: [{ type: "text", text: output }] };
      }

      // ========== WEB TOOLS ==========
      case "hev_web_search": {
        logToolCall("hev_web_search", args);
        return await handleWebSearch(args as Record<string, unknown>);
      }

      case "hev_web_fetch": {
        logToolCall("hev_web_fetch", args);
        return await handleWebFetch(args as Record<string, unknown>);
      }

      case "hev_web_search_and_fetch": {
        logToolCall("hev_web_search_and_fetch", args);
        return await handleWebSearchAndFetch(args as Record<string, unknown>);
      }

      // ========== WORKFLOW TOOLS ==========
      case "hev_run_workflow": {
        const result = await runWorkflow((args as { workflow: string }).workflow);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "hev_run_steps": {
        const result = await runCustomSteps((args as { steps: unknown[] }).steps);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "hev_list_workflows": {
        const result = listWorkflows();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ========== GIT TOOLS ==========
      case "hev_git_fork_setup": {
        const a = args as { repo: string; work_dir: string; base_branch?: string; feature_branch?: string; shallow?: boolean };
        const result = await gitForkSetup(a.repo, a.work_dir, a.base_branch || "main", a.feature_branch, a.shallow ?? true);
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_git_create_pr": {
        const a = args as { base_branch: string; title: string; body?: string; cwd?: string };
        const result = await gitCreatePr(a.base_branch, a.title, a.body, a.cwd);
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_git_check_guidelines": {
        const result = await gitCheckGuidelines((args as { cwd?: string }).cwd);
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_git_pr_status": {
        const result = await gitPrStatus((args as { cwd?: string }).cwd);
        return { content: [{ type: "text", text: result.message }] };
      }

      // ========== CONTEXT TOOLS ==========
      case "hev_context_generate": {
        const a = args as { level?: string; force?: boolean; include_content?: boolean };
        const result = await generateContext(PROJECT_ROOT, {
          level: (a.level as "L1" | "L2" | "L3" | "L4") || "L2",
          force: a.force,
          includeContent: a.include_content,
        });
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_context_status": {
        const status = await contextStatus(PROJECT_ROOT);
        let output = `📊 Context Status\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `Repomix: ${status.repomixVersion}\n`;
        output += `Available: ${status.available.join(", ")}\n\n`;
        for (const level of ["L1", "L2", "L3", "L4"] as const) {
          const info = status.current[level];
          if (info) {
            output += `${level}: ${info.sizeKB}KB, ~${info.tokens.toLocaleString()} tokens (${info.age})\n`;
          } else {
            output += `${level}: not generated\n`;
          }
        }
        return { content: [{ type: "text", text: output }] };
      }

      case "hev_context_module": {
        const a = args as { module: string; include_tests?: boolean };
        const result = await moduleContext(PROJECT_ROOT, { module: a.module, includeTests: a.include_tests });
        return { content: [{ type: "text", text: result.message }] };
      }

      case "hev_context_read": {
        const a = args as { level?: string };
        const result = readContext(PROJECT_ROOT, (a.level as "L1" | "L2" | "L3" | "L4") || "L2");
        return { content: [{ type: "text", text: result.content }] };
      }

      default:
        throw new Error(`Bilinmeyen tool: ${name}`);
    }
  } catch (err) { 
    const error = err as Error;
    logToolError(name, error, args, startTime);
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hayalet-ev MCP Server v1.7.0 başlatıldı (CDP + Filesystem + Dev Tools + Recycle Bin + Logging)");
}

main().catch((err) => {
  const error = err as Error;
  logError("Server başlatma hatası", error);
  console.error("Server hatası:", error);
  process.exit(1);
});
