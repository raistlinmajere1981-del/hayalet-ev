/**
 * App Entry Point (Proxy)
 *
 * Preload script bu dosyayı `/js/app.js` olarak yükler.
 * Tüm implementasyon `./app/` klasöründedir.
 *
 * @see electron/preload.cjs - injectInitApp()
 * @see src/js/app/index.ts - Ana orchestrator
 */

// Side-effect import: initApp() DOMContentLoaded'da çalışır
import "./app/index.js";

// Re-export public API (geriye dönük uyumluluk)
export { showPage, getCurrentPage } from "./app/index.js";
