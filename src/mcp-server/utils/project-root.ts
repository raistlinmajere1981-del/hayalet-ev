/**
 * Project Root Resolver
 *
 * Circular dependency sorunlarını önlemek için PROJECT_ROOT'u
 * ayrı bir dosyada tanımlıyoruz.
 *
 * import.meta.url kullanarak dosya konumundan proje kökünü bulur.
 * Bu sayede MCP server hangi dizinden çalıştırılırsa çalıştırılsın
 * doğru proje kökünü gösterir.
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// import.meta.url ile bu dosyanın konumunu bul
// Bu dosya: src/mcp-server/utils/project-root.ts (veya dist/mcp-server/utils/project-root.js)
// Proje kökü: 3 seviye yukarı
const moduleFileName = fileURLToPath(import.meta.url);
const moduleDirName = dirname(moduleFileName);
export const PROJECT_ROOT = resolve(moduleDirName, "..", "..", "..");
