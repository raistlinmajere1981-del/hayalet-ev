/**
 * App Entry Point (Proxy)
 *
 * The preload script loads this file as `/js/app.js`.
 * The full implementation lives under `./app/`.
 *
 * @see electron/preload.cjs - injectInitApp()
 * @see src/js/app/index.ts - Main orchestrator
 */

// Side-effect import: initApp() runs on DOMContentLoaded.
import "./app/index.js";

// Re-export the public API for backward compatibility.
export { showPage, getCurrentPage } from "./app/index.js";
