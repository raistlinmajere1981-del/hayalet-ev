/**
 * OpenCode UI - Entry Point
 * 
 * Tüm bileşenleri import edip global scope'a kaydet.
 * Vite compatibility için tek entry point.
 */

// Import all components (yeni path'ler)
import '../../modules/asistan/providers/opencode-native/config.js';
import '../../modules/asistan/providers/opencode-native/api-client.js';
import '../../modules/asistan/providers/opencode-native/sse-client.js';
import '../../modules/asistan/stores/index.js';
import '../../modules/asistan/ui/agent-model-selector.js';
import '../../modules/asistan/ui/directory-browser.js';
import '../../modules/asistan/ui/instance-tabs.js';
import '../../modules/asistan/ui/permission-modal.js';
import '../../modules/asistan/ui/question-modal.js';
import '../../modules/asistan/ui/message-renderer.js';
import '../../modules/asistan/ui/tool-renderer.js';
import '../../modules/asistan/ui/prompt-handler.js';
import './app.js';

// Components are now available in global scope via window object
console.log('[OpenCode] All components loaded');
