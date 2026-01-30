/**
 * Development Tools - Context Generator
 * 
 * Session context dosyası üretimi (.rovo/context.md)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { DEV_CONFIG } from "./shared/config.js";
import { getAllFiles, countLines } from "./shared/utils.js";

interface BootstrapResult {
  content: string;
  outputPath?: string;
  stats: { sections: number; lines: number };
}

export async function bootstrapContext(
  projectRoot: string,
  options: { print?: boolean; full?: boolean } = {}
): Promise<BootstrapResult> {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];
  
  // Header
  lines.push("# Hayalet-ev Project Context");
  lines.push(`> Auto-generated: ${now} | Regenerate: \`npm run bootstrap\``);
  lines.push("");

  // Package info
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8"));
    lines.push("╪╪ 📦 Proje Bilgisi");
    lines.push(`- **Ad:** ${pkg.name} v${pkg.version}`);
    
    // Git info
    try {
      const branch = execSync("git branch --show-current", { cwd: projectRoot, encoding: "utf-8" }).trim();
      const status = execSync("git status --short", { cwd: projectRoot, encoding: "utf-8" }).trim();
      lines.push(`- **Branch:** ${branch}`);
      lines.push(`- **Uncommitted:** ${status ? `${status.split("\n").length} dosya` : "Yok ✓"}`);
    } catch { /* ignore */ }
    lines.push("");
  } catch { /* ignore */ }

  // Directory stats
  lines.push("╪╪ 📊 Yapı Özeti");
  for (const srcDir of DEV_CONFIG.srcDirs) {
    const files = await getAllFiles(srcDir, projectRoot);
    let totalLines = 0;
    for (const file of files) {
      totalLines += countLines(join(projectRoot, file));
    }
    lines.push(`- \`${srcDir}/\`: ${files.length} dosya, ${totalLines} satır`);
  }
  lines.push("");

  // Module map
  lines.push("╪╪ 🗺️ Modül Haritası");
  lines.push("");
  lines.push("### Orchestrator'lar");
  lines.push("- core-engine.ts - Ana koordinatör");
  lines.push("- webview-manager.ts - Webview lifecycle");
  lines.push("- traffic-manager.ts - State tracking");
  lines.push("- slot-controller.ts - Slot yaşam döngüsü");
  lines.push("");

  // Critical rules
  lines.push("╪╪ ⚡ Kritik Kurallar");
  lines.push("❯ console.log kullanma → LogManager.addEvent() kullan");
  lines.push("✓ Her error log'a context ekle");
  lines.push("✓ Test sonrası logs/ klasörünü kontrol et");
  lines.push("");

  // Commands
  lines.push("╪╪ 🛠️ Sık Kullanılan Komutlar");
  lines.push("- \`npm start\` - Uygulamaı başlat");
  lines.push("- \`npm run lint\` - Kod kontrolü");
  lines.push("- \`npm run pre-commit\` - Commit öncesi");
  lines.push("");

  // Recent commits
  try {
    const commits = execSync("git log --oneline -5", { cwd: projectRoot, encoding: "utf-8" }).trim().split("\n");
    lines.push("╪╪ 🔄 Son Commit'ler");
    for (const commit of commits) {
      lines.push(`- ${commit}`);
    }
    lines.push("");
  } catch { /* ignore */ }

  lines.push("---");
  lines.push("*Bu dosya otomatik üretilir. Manuel düzenleme yapmayın.*");

  const content = lines.join("\n");
  
  // Write to file if not print mode
  let outputPath: string | undefined;
  if (!options.print) {
    outputPath = join(projectRoot, ".rovo/context.md");
    writeFileSync(outputPath, content, "utf-8");
  }

  return {
    content: options.print ? content : `Context dosyası oluşturuldu: ${outputPath}`,
    outputPath,
    stats: { sections: 6, lines: lines.length },
  };
}

export const CONTEXT_GENERATOR_TOOL = {
  name: "hev_dev_bootstrap_context",
  description: "Session context dosyası üret (.rovo/context.md). Yeni AI session başlatırken kullanışlı.",
  inputSchema: {
    type: "object" as const,
    properties: {
      print: {
        type: "boolean" as const,
        description: "Dosyaya yazmak yerine içeriği döndür",
        default: false,
      },
      full: {
        type: "boolean" as const,
        description: "Detaylı versiyon",
        default: false,
      },
    },
  },
};
