/**
 * Registry API - Register/unregister renderers + hooks
 */

import type { ToolRendererConfig, HookType, HookCallback, RegistryListener, RegistryEvent } from './types.js';

function createRegistryApi(
  renderers: Map<string, ToolRendererConfig>,
  listeners: Set<RegistryListener>,
  hooks: Map<string, HookCallback[]>,
  notifyFn: (event: RegistryEvent) => void
) {
  return {
    /**
     * Register a custom renderer for a tool
     */
    register(toolName: string, config: ToolRendererConfig) {
      renderers.set(toolName, {
        name: toolName,
        ...config,
      });
      console.log('[ToolRendererRegistry] Registered:', toolName);
      notifyFn({ type: 'renderer:registered', toolName });

      // Return unregister function
      return () => this.unregister(toolName);
    },

    /**
     * Alias for register (extensibility API)
     */
    registerRenderer(toolName: string, config: ToolRendererConfig) {
      return this.register(toolName, config);
    },

    /**
     * Unregister a tool renderer
     */
    unregister(toolName: string) {
      const existed = renderers.delete(toolName);
      if (existed) {
        console.log('[ToolRendererRegistry] Unregistered:', toolName);
        notifyFn({ type: 'renderer:unregistered', toolName });
      }
      return existed;
    },

    /**
     * Alias for unregister (extensibility API)
     */
    unregisterRenderer(toolName: string) {
      return this.unregister(toolName);
    },

    /**
     * Add a hook for tool events
     */
    addHook(toolName: string, hookType: HookType, callback: HookCallback) {
      const key = `${toolName}:${hookType}`;
      if (!hooks.has(key)) {
        hooks.set(key, []);
      }
      hooks.get(key)!.push(callback);

      return () => this.removeHook(toolName, hookType, callback);
    },

    /**
     * Remove a hook
     */
    removeHook(toolName: string, hookType: HookType, callback: HookCallback) {
      const key = `${toolName}:${hookType}`;
      const hookList = hooks.get(key);
      if (hookList) {
        const index = hookList.indexOf(callback);
        if (index !== -1) {
          hookList.splice(index, 1);
        }
      }
    },

    /**
     * Execute hooks for a tool
     */
    _executeHooks(toolName: string, hookType: HookType, data: unknown) {
      // Tool-specific hooks
      const specificKey = `${toolName}:${hookType}`;
      const specificHooks = hooks.get(specificKey) || [];

      // Wildcard hooks (apply to all tools)
      const wildcardKey = `*:${hookType}`;
      const wildcardHooks = hooks.get(wildcardKey) || [];

      [...wildcardHooks, ...specificHooks].forEach((hook) => {
        try {
          hook(data);
        } catch (err) {
          console.error('[ToolRendererRegistry] Hook error:', err);
        }
      });
    },

    /**
     * Subscribe to registry changes
     */
    subscribe(listener: RegistryListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Notify listeners
     */
    _notify(event: RegistryEvent) {
      listeners.forEach((listener: RegistryListener) => {
        try {
          listener(event);
        } catch (err) {
          console.error('[ToolRendererRegistry] Listener error:', err);
        }
      });
    },

    /**
     * Get registered tools
     */
    getRegisteredTools() {
      return Array.from(renderers.keys());
    },
  };
}

export { createRegistryApi };
