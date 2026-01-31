/**
 * Context Generation Tools for MCP Server
 * 
 * Repomix entegrasyonu ile çok seviyeli proje context'i:
 * - hev_context_generate: Belirli seviyede context üret
 * - hev_context_module: Spesifik modül için context
 * - hev_context_status: Mevcut context durumu
 * - hev_context_diff: Son değişikliklerden etkilenen dosyalar
 */

import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { createProgress } from "../utils/progress.js";

// Context seviyeleri
type ContextLevel = "L1" | "L2" | "L3" | "L4";

interface ContextResult {
  success: boolean;
  level: ContextLevel | "custom";
  outputPath: string;
  stats: {
    files: number;
    tokens: number;
    chars: number;
    sizeKB: number;
  };
  cached: boolean;
  message: string;
}

interface ContextStatus {
  available: ContextLevel[];
  current: Record<ContextLevel, { exists: boolean; sizeKB: number; age: string; tokens: number } | null>;
  repomixVersion: string;
  lastGenerated?: string;
}

// Level descriptions
const LEVEL_INFO: Record<ContextLevel, { name: string; description: string; files: string }> = {
  L1: { name: "Quick", description: "AGENTS.md + package.json", files: "~2" },
  L2: { name: "Standard", description: "Orchestrator'lar + types", files: "~17" },
  L3: { name: "Deep", description: "Tüm src/js + electron", files: "~150" },
  L4: { name: "Full", description: "MCP server dahil tam proje", files: "~190" },
};

// Config dosyası yolları
const CONFIG_DIR = ".rovo/context-configs";
const OUTPUT_DIR = ".rovo/context";

// Helper: Repomix çalıştır
async function runRepomix(configPath: string, projectRoot: string): Promise<{ success: boolean; output: string; stats?: { files: number; tokens: number; chars: number } }> {
  return new Promise((resolve) => {
    const child = spawn("repomix", ["--config", configPath], { cwd: projectRoot });
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    
    child.on("close", (code) => {
      const output = stdout + stderr;
      
      // Parse stats from output
      const filesMatch = output.match(/Total Files:\s*(\d+)/);
      const tokensMatch = output.match(/Total Tokens:\s*([\d,]+)/);
      const charsMatch = output.match(/Total Chars:\s*([\d,]+)/);
      
      resolve({
        success: code === 0,
        output,
        stats: filesMatch ? {
          files: parseInt(filesMatch[1] || '0'),
          tokens: parseInt((tokensMatch?.[1] || "0").replace(/,/g, "")),
          chars: parseInt((charsMatch?.[1] || "0").replace(/,/g, "")),
        } : undefined,
      });
    });
    
    // Timeout
    setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ success: false, output: "Timeout (180s)" });
    }, 180000);
  });
}

// Helper: Zaman farkı formatla
function formatAge(mtime: Date): string {
  const diffMs = Date.now() - mtime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
}

// ============================================
// Tool 1: Generate Context
// ============================================

export async function generateContext(
  projectRoot: string,
  options: { level?: ContextLevel; force?: boolean; includeContent?: boolean } = {}
): Promise<ContextResult> {
  const level = options.level || "L2";
  const progress = createProgress({ operation: `Context ${level}`, total: 100 });
  
  const configPath = join(projectRoot, CONFIG_DIR, `level-${level.toLowerCase().replace("l", "")}-${getLevelName(level)}.json`);
  const outputPath = join(projectRoot, OUTPUT_DIR, `${level}-${getLevelName(level)}.txt`);
  
  // Config var mı?
  if (!existsSync(configPath)) {
    return {
      success: false, level, outputPath, cached: false,
      stats: { files: 0, tokens: 0, chars: 0, sizeKB: 0 },
      message: `Config bulunamadı: ${configPath}`,
    };
  }
  
  // Cache kontrolü (force değilse)
  if (!options.force && existsSync(outputPath)) {
    const stat = statSync(outputPath);
    const ageMs = Date.now() - stat.mtime.getTime();
    
    // 1 saatten yeni ise cache kullan
    if (ageMs < 3600000) {
      const content = readFileSync(outputPath, "utf-8");
      const tokenEstimate = Math.round(content.length / 4);
      
      progress.done(`Cache kullanıldı (${formatAge(stat.mtime)})`);
      
      return {
        success: true, level, outputPath, cached: true,
        stats: { files: 0, tokens: tokenEstimate, chars: content.length, sizeKB: Math.round(stat.size / 1024) },
        message: options.includeContent ? content : `✅ Cache kullanıldı: ${outputPath}\nYaş: ${formatAge(stat.mtime)}\nBoyut: ${Math.round(stat.size / 1024)}KB`,
      };
    }
  }
  
  // Repomix çalıştır
  progress.update(30, "Repomix çalıştırılıyor...");
  const result = await runRepomix(configPath, projectRoot);
  
  if (!result.success) {
    progress.fail("Repomix hatası");
    return {
      success: false, level, outputPath, cached: false,
      stats: { files: 0, tokens: 0, chars: 0, sizeKB: 0 },
      message: `Repomix hatası: ${result.output}`,
    };
  }
  
  // Sonuçları oku
  const stat = statSync(outputPath);
  const sizeKB = Math.round(stat.size / 1024);
  
  progress.done(`${result.stats?.files || 0} dosya, ${sizeKB}KB`);
  
  let message = `✅ Context oluşturuldu: ${level} (${LEVEL_INFO[level].name})\n`;
  message += `📁 Dosya: ${result.stats?.files || 0}\n`;
  message += `🔢 Token: ${result.stats?.tokens?.toLocaleString() || 0}\n`;
  message += `📊 Boyut: ${sizeKB}KB\n`;
  message += `📍 Path: ${outputPath}`;
  
  if (options.includeContent) {
    message = readFileSync(outputPath, "utf-8");
  }
  
  return {
    success: true, level, outputPath, cached: false,
    stats: { files: result.stats?.files || 0, tokens: result.stats?.tokens || 0, chars: result.stats?.chars || 0, sizeKB },
    message,
  };
}

function getLevelName(level: ContextLevel): string {
  return LEVEL_INFO[level].name.toLowerCase();
}

// ============================================
// Tool 2: Context Status
// ============================================

export async function contextStatus(projectRoot: string): Promise<ContextStatus> {
  const status: ContextStatus = {
    available: [],
    current: { L1: null, L2: null, L3: null, L4: null },
    repomixVersion: "unknown",
  };
  
  // Repomix versiyonu
  try {
    status.repomixVersion = execSync("repomix --version", { encoding: "utf-8" }).trim();
  } catch { /* ignore */ }
  
  // Her seviye için kontrol
  for (const level of ["L1", "L2", "L3", "L4"] as ContextLevel[]) {
    const configPath = join(projectRoot, CONFIG_DIR, `level-${level.toLowerCase().replace("l", "")}-${getLevelName(level)}.json`);
    const outputPath = join(projectRoot, OUTPUT_DIR, `${level}-${getLevelName(level)}.txt`);
    
    if (existsSync(configPath)) {
      status.available.push(level);
    }
    
    if (existsSync(outputPath)) {
      const stat = statSync(outputPath);
      const content = readFileSync(outputPath, "utf-8");
      const tokenEstimate = Math.round(content.length / 4);
      
      status.current[level] = {
        exists: true,
        sizeKB: Math.round(stat.size / 1024),
        age: formatAge(stat.mtime),
        tokens: tokenEstimate,
      };
      
      if (!status.lastGenerated || stat.mtime > new Date(status.lastGenerated)) {
        status.lastGenerated = stat.mtime.toISOString();
      }
    }
  }
  
  return status;
}

// ============================================
// Tool 3: Module Context (Custom)
// ============================================

export async function moduleContext(
  projectRoot: string,
  options: { module: string; includeTests?: boolean }
): Promise<ContextResult> {
  const moduleName = options.module;
  const progress = createProgress({ operation: `Module: ${moduleName}`, total: 100 });
  
  // Dinamik config oluştur
  const patterns: string[] = [];
  
  // Module pattern'leri
  if (moduleName.includes("/")) {
    patterns.push(moduleName);
  } else {
    patterns.push(
      `src/js/modules/${moduleName}/**/*.ts`,
      `src/js/modules/${moduleName}.ts`,
      `src/js/modules/**/${moduleName}*.ts`,
      `electron/${moduleName}*.ts`,
      `electron/**/${moduleName}*.ts`,
      `mcp-server/**/${moduleName}*.ts`
    );
  }
  
  // Test dosyaları
  if (options.includeTests) {
    patterns.push(`**/${moduleName}*.test.ts`, `**/${moduleName}*.spec.ts`);
  }
  
  // Geçici config oluştur
  const tempConfig = {
    output: {
      style: "plain",
      filePath: `.rovo/context/module-${moduleName.replace(/\//g, "-")}.txt`,
      headerText: `# Hayalet-ev Context - Module: ${moduleName}\n`,
      showLineNumbers: true,
    },
    include: ["AGENTS.md", ...patterns],
    ignore: { useDefaultPatterns: true },
  };
  
  const tempConfigPath = join(projectRoot, ".rovo/context-configs/temp-module.json");
  writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
  
  progress.update(30, "Repomix çalıştırılıyor...");
  const result = await runRepomix(tempConfigPath, projectRoot);
  
  const outputPath = join(projectRoot, tempConfig.output.filePath);
  
  if (!result.success || !existsSync(outputPath)) {
    progress.fail("Module context oluşturulamadı");
    return {
      success: false, level: "custom", outputPath, cached: false,
      stats: { files: 0, tokens: 0, chars: 0, sizeKB: 0 },
      message: `Module context hatası: ${result.output}`,
    };
  }
  
  const stat = statSync(outputPath);
  const sizeKB = Math.round(stat.size / 1024);
  
  progress.done(`${result.stats?.files || 0} dosya, ${sizeKB}KB`);
  
  return {
    success: true, level: "custom", outputPath, cached: false,
    stats: { files: result.stats?.files || 0, tokens: result.stats?.tokens || 0, chars: result.stats?.chars || 0, sizeKB },
    message: `✅ Module context: ${moduleName}\n📁 ${result.stats?.files || 0} dosya\n📊 ${sizeKB}KB\n📍 ${outputPath}`,
  };
}

// ============================================
// Tool 4: Read Context
// ============================================

export function readContext(projectRoot: string, level: ContextLevel): { success: boolean; content: string; stats?: { sizeKB: number; tokens: number } } {
  const outputPath = join(projectRoot, OUTPUT_DIR, `${level}-${getLevelName(level)}.txt`);
  
  if (!existsSync(outputPath)) {
    return { success: false, content: `Context dosyası bulunamadı: ${outputPath}\nÖnce hev_context_generate level=${level} çalıştırın.` };
  }
  
  const content = readFileSync(outputPath, "utf-8");
  const stat = statSync(outputPath);
  
  return {
    success: true,
    content,
    stats: {
      sizeKB: Math.round(stat.size / 1024),
      tokens: Math.round(content.length / 4),
    },
  };
}

// ============================================
// Tool Definitions
// ============================================

export const CONTEXT_TOOL_DEFINITIONS = [
  {
    name: "hev_context_generate",
    description: "Proje context'i oluştur (Repomix). L1=Quick(7K), L2=Standard(48K), L3=Deep(360K), L4=Full(518K token)",
    inputSchema: {
      type: "object" as const,
      properties: {
        level: {
          type: "string",
          enum: ["L1", "L2", "L3", "L4"],
          description: "Context seviyesi: L1(hızlı), L2(standart), L3(derin), L4(tam)",
          default: "L2",
        },
        force: {
          type: "boolean",
          description: "Cache'i yoksay, yeniden oluştur",
          default: false,
        },
        include_content: {
          type: "boolean",
          description: "Context içeriğini döndür (büyük olabilir!)",
          default: false,
        },
      },
    },
    metadata: {
      category: 'context',
      subcategory: 'generation',
      priority: 'high',
      complexity: 'medium',
      useCases: ['Proje context oluştur', 'AI ile paylaşım için codebase özeti', 'Kod analizi'],
      relatedTools: ['hev_context_status', 'hev_context_read'],
      agentGuidance: 'Proje context\'i oluştur. L2 (48K token) standart, L3/L4 büyük projeler için. Cache\'li.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['context', 'repomix', 'codebase', 'generation']
    }
  },
  {
    name: "hev_context_status",
    description: "Mevcut context dosyalarının durumunu göster (boyut, yaş, token sayısı)",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    metadata: {
      category: 'context',
      subcategory: 'status',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Context dosyalarını kontrol et', 'Cache durumu', 'Token sayısı'],
      relatedTools: ['hev_context_generate'],
      agentGuidance: 'Hangi context dosyaları var ve ne kadar güncel kontrol et.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['context', 'status', 'cache']
    }
  },
  {
    name: "hev_context_module",
    description: "Belirli bir modül için özel context oluştur (örn: webview, traffic, slot)",
    inputSchema: {
      type: "object" as const,
      properties: {
        module: {
          type: "string",
          description: "Modül adı veya path pattern (örn: webview, traffic, slot-controller)",
        },
        include_tests: {
          type: "boolean",
          description: "Test dosyalarını dahil et",
          default: false,
        },
      },
      required: ["module"],
    },
    metadata: {
      category: 'context',
      subcategory: 'module',
      priority: 'medium',
      complexity: 'simple',
      useCases: ['Modül-specific context', 'Odaklanmış analiz', 'Küçük scope'],
      relatedTools: ['hev_context_generate'],
      agentGuidance: 'Belirli bir modül için context oluştur. Full context yerine focused analiz için kullan.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['context', 'module', 'focused']
    }
  },
  {
    name: "hev_context_read",
    description: "Oluşturulmuş context dosyasını oku. Önce hev_context_generate ile oluşturulmalı.",
    inputSchema: {
      type: "object" as const,
      properties: {
        level: {
          type: "string",
          enum: ["L1", "L2", "L3", "L4"],
          description: "Okunacak context seviyesi",
          default: "L2",
        },
      },
    },
    metadata: {
      category: 'context',
      subcategory: 'read',
      priority: 'low',
      complexity: 'simple',
      useCases: ['Oluşturulmuş context\'i oku', 'Cache\'den context yükle'],
      relatedTools: ['hev_context_generate', 'hev_context_status'],
      agentGuidance: 'Generate edilmiş context dosyasını oku. Önce hev_context_generate çalıştırmalısın.',
      requiresConfirmation: false,
      riskLevel: 'low',
      tags: ['context', 'read', 'cache']
    }
  },
];

// Auto-generated metadata for listTools()
export const CONTEXT_TOOL_METADATA = {
  category: "Context Generation",
  emoji: "📊",
  tools: CONTEXT_TOOL_DEFINITIONS.map(t => t.name)
};
