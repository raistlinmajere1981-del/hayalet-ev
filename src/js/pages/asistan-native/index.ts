/**
 * OpenCode UI - Entry Point
 * 
 * Tüm bileşenleri import edip global scope'a kaydet.
 * Vite compatibility için tek entry point.
 */

// Import all components
import '../../modules/asistan/providers/opencode-native/config';
import '../../modules/asistan/providers/opencode-native/api-client';
import '../../modules/asistan/providers/opencode-native/sse-client';
import '../../modules/asistan/stores/index';
import '../../modules/asistan/ui/agent-model-selector';
import '../../modules/asistan/ui/directory-browser';
import '../../modules/asistan/ui/instance-tabs';
import '../../modules/asistan/ui/permission-modal';
import '../../modules/asistan/ui/question-modal';
import '../../modules/asistan/ui/message-renderer/index';
import '../../modules/asistan/ui/tool-renderer';
import '../../modules/asistan/ui/prompt-handler/index';
import './app';

// Components are now available in global scope via window object
console.log('[OpenCode] All components loaded');
