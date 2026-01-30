/**
 * Instance Management - Multi-workspace support
 */

import type { InstanceInfo, AppContext } from './types';

export function setupInstanceManagement(context: AppContext) {
  return {
    createInstance(folder: string, name?: string) {
      if (!window.InstanceStore) return null;
      
      const instance = window.InstanceStore.createInstance?.({
        folder,
        name: name || folder.split('/').pop() || folder.split('\\').pop() || 'Workspace',
        url: context._serverUrl,
      });

      if (instance) {
        window.InstanceStore.setInstanceStatus?.(instance.id, 'disconnected');
        console.log('[OpenCode] Created instance:', instance.name);
      }

      return instance;
    },
    closeInstance(instanceId: string) {
      if (!window.InstanceStore) return;

      const instance = window.InstanceStore.getInstance?.(instanceId);
      if (instance) {
        window.InstanceStore.removeInstance?.(instanceId);
        console.log('[OpenCode] Removed instance:', instance.name);
      }
    },

    switchInstance(instanceId: string) {
      if (!window.InstanceStore) return;

      const instance = window.InstanceStore.getInstance?.(instanceId);
      if (instance) {
        window.InstanceStore.setActiveInstance?.(instanceId);
        context._onInstanceActivated?.(instance);
        console.log('[OpenCode] Switched to instance:', instance.name);
      }
    },


    onInstanceSelect(instanceId: string) {
      context.switchInstance(instanceId);
    },

    onInstanceClose(instanceId: string) {
      context._closeInstance?.(instanceId);
      context._updateInstanceUI?.();
    },

    async onInstanceNew() {
      const newFolder = prompt('Workspace klasörünü girin:');
      if (newFolder) {
        await context._createInstance?.({ folder: newFolder });
        context._updateInstanceUI?.();
      }
    },

    onInstanceActivated(instance: InstanceInfo) {
      context._workspace = instance.folder;
      sessionStorage.setItem('opencode-workspace', instance.folder);

      if (window.APIClient) {
        const serverUrl = (instance.url || context._serverUrl) as string;
        window.APIClient.setServerUrl?.(serverUrl);
      }

      context._updateInstanceUI();
      context._updateTokenDisplay();
      context._updateSessionList();

    },

    updateInstanceUI() {
      if (!window.InstanceStore) return;

      const container = document.getElementById('instance-tabs');
      if (!container) return;

      const instances = (window.InstanceStore.getInstancesArray?.() || []) as InstanceInfo[];
      const activeId = window.InstanceStore.getActiveInstance?.()?.id;


      container.innerHTML = '';

      instances.forEach((instance: InstanceInfo) => {
        const tab = document.createElement('div');
        tab.className = `instance-tab ${instance.id === activeId ? 'active' : ''}`;
        tab.textContent = instance.name;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'instance-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (instances.length > 1) {
            context._onInstanceClose(instance.id);
          } else {
            context._showToast('En az bir instance gerekli', 'warning');
          }
        });

        tab.appendChild(closeBtn);
        tab.addEventListener('click', () => context._onInstanceSelect(instance.id));
        container.appendChild(tab);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'instance-add';
      addBtn.textContent = '+';
      addBtn.addEventListener('click', () => context._onInstanceNew());
      container.appendChild(addBtn);
    },

    initInstanceTabs() {
      if (!window.InstanceStore) {
        console.warn('[OpenCode] InstanceStore not available');
        return;
      }

      context._updateInstanceUI();

      if (window.InstanceStore.subscribe) {
        window.InstanceStore.subscribe((event) => {
          if (event.type === 'instance:created' || event.type === 'instance:removed' || event.type === 'instance:active') {
            context._updateInstanceUI();
          }
        });
      }
    },

    async ensureInstanceExists() {
      if (!window.InstanceStore) return;

      const instances = (window.InstanceStore.getInstancesArray?.() || []) as InstanceInfo[];

      if (instances.length === 0 && context._workspace) {
        await context._createInstance?.({ folder: context._workspace });
        console.log('[OpenCode] Created default instance');
      } else if (instances.length > 0) {
        const activeInstance = window.InstanceStore.getActiveInstance?.();
        if (activeInstance) {
          context._onInstanceActivated?.(activeInstance as InstanceInfo);
        }
      }
    },
  };
}


