/**
 * Tool Renderer Registry Manager (Main singleton)
 *
 * Per-tool custom renderer sistemi.
 * Her tool için özel görünüm ve davranış tanımlanabilir.
 * Adapted from CodeNomad's tool-call/resolveToolRenderer pattern
 */

import type {
  ToolRendererConfig,
  ToolCallData,
  HookType,
  HookCallback,
  RegistryListener,
  RegistryEvent,
} from './types.js';
import { createRegistryApi } from './registry-api.js';
import { createRenderHelpers } from './render-helpers.js';
import { createDefaultRenderers } from './default-renderers.js';
import { escapeHtml, copyToClipboard } from './utils.js';

const ToolRendererRegistry = {
  /** Map of tool name → renderer config */
  _renderers: new Map<string, ToolRendererConfig>(),

  /** Default renderer for unregistered tools */
  _defaultRenderer: null as ToolRendererConfig | null,

  /** Listeners for registry changes */
  _listeners: new Set<RegistryListener>(),

  /** Tool-specific hooks */
  _hooks: new Map<string, HookCallback[]>(),

  // Initialize helper functions
  _escapeHtml: escapeHtml,

  // =========================================================================
  // Initialization (lazy)
  // =========================================================================

  _registryApi: null as ReturnType<typeof createRegistryApi> | null,
  _renderHelpers: null as ReturnType<typeof createRenderHelpers> | null,
  _defaultRenderers: null as ReturnType<typeof createDefaultRenderers> | null,

  _initHelpers() {
    if (!this._registryApi) {
      this._defaultRenderers = createDefaultRenderers(this._escapeHtml);
      this._registryApi = createRegistryApi(
        this._renderers,
        this._listeners,
        this._hooks,
        (event) => this._notify(event)
      );
      this._renderHelpers = createRenderHelpers(
        (toolName) => this._renderers.get(toolName),
        this._defaultRenderer || undefined,
        (toolName, hookType, data) => {
          if (!this._registryApi) throw new Error('Registry API not initialized');
          return this._registryApi._executeHooks(toolName, hookType as HookType, data);
        },
        this._escapeHtml,
        (input) => {
          if (!this._defaultRenderers) throw new Error('Default renderers not initialized');
          return this._defaultRenderers.defaultRenderInput(input);
        },
        (output) => {
          if (!this._defaultRenderers) throw new Error('Default renderers not initialized');
          return this._defaultRenderers.defaultRenderOutput(output);
        }
      );
    }
  },

  // =========================================================================
  // Registry API (delegated)
  // =========================================================================

  register(toolName: string, config: ToolRendererConfig) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.register(toolName, config);
  },

  registerRenderer(toolName: string, config: ToolRendererConfig) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.registerRenderer(toolName, config);
  },

  unregister(toolName: string) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.unregister(toolName);
  },

  unregisterRenderer(toolName: string) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.unregisterRenderer(toolName);
  },

  addHook(toolName: string, hookType: HookType, callback: HookCallback) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.addHook(toolName, hookType, callback);
  },

  removeHook(toolName: string, hookType: HookType, callback: HookCallback) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.removeHook(toolName, hookType, callback);
  },

  subscribe(listener: RegistryListener) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.subscribe(listener);
  },

  getRegisteredTools() {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi.getRegisteredTools();
  },

  /**
   * Set default renderer for unregistered tools
   */
  setDefault(config: ToolRendererConfig) {
    this._defaultRenderer = config;
    this._notify({ type: 'default:changed' });
  },

  /**
   * Notify listeners
   */
  _notify(event: RegistryEvent) {
    this._listeners.forEach((listener: RegistryListener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[ToolRendererRegistry] Listener error:', err);
      }
    });
  },

  // =========================================================================
  // Render Helpers (delegated)
  // =========================================================================

  renderToolCard(toolCall: ToolCallData) {
    this._initHelpers();
    if (!this._renderHelpers) throw new Error('Render helpers not initialized');
    return this._renderHelpers.renderToolCard(toolCall);
  },

  updateStatus(toolCall: ToolCallData, newStatus: string) {
    this._initHelpers();
    if (!this._renderHelpers) throw new Error('Render helpers not initialized');
    return this._renderHelpers.updateStatus(toolCall, newStatus);
  },

  renderInput(toolCall: ToolCallData) {
    this._initHelpers();
    if (!this._renderHelpers) throw new Error('Render helpers not initialized');
    return this._renderHelpers.renderInput(toolCall);
  },

  renderOutput(toolCall: ToolCallData) {
    this._initHelpers();
    if (!this._renderHelpers) throw new Error('Render helpers not initialized');
    return this._renderHelpers.renderOutput(toolCall);
  },

  shouldAutoCollapse(toolCall: ToolCallData) {
    this._initHelpers();
    if (!this._renderHelpers) throw new Error('Render helpers not initialized');
    return this._renderHelpers.shouldAutoCollapse(toolCall);
  },

  get(toolName: string) {
    this._initHelpers();
    if (!this._renderHelpers) throw new Error('Render helpers not initialized');
    return this._renderHelpers.get(toolName);
  },

  has(toolName: string) {
    this._initHelpers();
    if (!this._renderHelpers) throw new Error('Render helpers not initialized');
    return this._renderHelpers.has(toolName);
  },

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Copy to clipboard handler
   */
  _copyToClipboard(btn: HTMLElement) {
    copyToClipboard(btn);
  },

  /**
   * Execute hooks for a tool (internal)
   */
  _executeHooks(toolName: string, hookType: HookType, data: unknown) {
    this._initHelpers();
    if (!this._registryApi) throw new Error('Registry API not initialized');
    return this._registryApi._executeHooks(toolName, hookType, data);
  },
};

// Global export (backward compatibility)
(window as any).ToolRendererRegistry = ToolRendererRegistry;

export { ToolRendererRegistry };
