/**
 * OpenCode UI - Entry Point
 * 
 * Tüm modülleri sırasıyla yükler ve global scope'a ekler.
 * Vite dev mode için gerekli.
 */

// Config
import './config.js';

// Stores
import './stores/types.js';
import './stores/normalizers.js';
import './stores/instance-store.js';
import './stores/message-store.js';
import './stores/session-store.js';
import './stores/attachment-store.js';
import './stores/store-bridge.js';
import './stores/index.js';

// Core modules
import './sse-client.js';
import './api-client.js';
import './agent-model-selector.js';

// UI modules
import './message-renderer.js';
import './prompt-handler.js';
import './directory-browser.js';

// Tool renderers
import './tool-renderers/index.js';
import './tool-renderer.js';
import './tool-renderers/read-renderer.js';
import './tool-renderers/write-renderer.js';
import './tool-renderers/bash-renderer.js';

// Modals
import './permission-modal.js';
import './question-modal.js';

// Instance management
import './instance-tabs.js';

// Main app (must be last)
import './app.js';

console.log('[OpenCode] All modules loaded via index.js');
