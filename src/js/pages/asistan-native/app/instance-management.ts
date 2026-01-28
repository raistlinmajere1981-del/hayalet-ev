/**
 * Instance Management - Multi-workspace support
 */

import type { InstanceInfo } from './types';

export function setupInstanceManagement(context: any) {
  return {
    createInstance(folder: string, name?: string) {
      const instance = typeof (window as any).InstanceStore !== 'undefined' ? (window as any).InstanceStore.createInstance({
        folder,
        name: name || folder.split('/').pop() || folder.split('\\').pop() || 'Workspace',
        url: context._serverUrl,
      }) : null;

      if (instance) {
        (window as any).InstanceStore.setInstanceStatus(instance.id, 'disconnected');
        console.log('[OpenCode] Created instance:', instance.name);
      }

      return instance;
    },

    closeInstance(instanceId: string) {
      if (typeof (window as any).InstanceStore === 'undefined') return;

      const instance = (window as any).InstanceStore.findById(instanceId);
      if (instance) {
        (window as any).InstanceStore.removeInstance(instanceId);
        console.log('[OpenCode] Removed instance:', instance.name);
      }
    },

    switchInstance(instanceId: string) {
      if (typeof (window as any).InstanceStore === 'undefined') return;

      const instance = (window as any).InstanceStore.findById(instanceId);
      if (instance) {
        (window as any).InstanceStore.setActiveInstance(instanceId);
        context._onInstanceActivated(instance);
        console.log('[OpenCode] Switched to instance:', instance.name);
      }
    },

    onInstanceSelect(instanceId: string) {
      context.switchInstance(instanceId);
    },

    onInstanceClose(instanceId: string) {
      context.closeInstance(instanceId);
      context._updateInstanceUI();
    },

    onInstanceNew() {
      const newFolder = prompt('Workspace klasörünü girin:');
      if (newFolder) {
        const instance = context.createInstance(newFolder);
        if (instance) {
          context.switchInstance(instance.id);
          context._updateInstanceUI();
        }
      }
    },

    onInstanceActivated(instance: InstanceInfo) {
      context._workspace = instance.folder;
      sessionStorage.setItem('opencode-workspace', instance.folder);

      (window as any).APIClient.setServerUrl(instance.url || context._serverUrl);

      context._updateInstanceUI();
      context._updateTokenDisplay();
      context._updateSessionList();

      console.log('[OpenCode] Instance activated:', instance.name, instance.folder);
    },

    updateInstanceUI() {
      if (typeof (window as any).InstanceStore === 'undefined') return;

      const container = document.getElementById('instance-tabs');
      if (!container) return;

      const instances = (window as any).InstanceStore.getInstancesArray() as InstanceInfo[];
      const activeId = (window as any).InstanceStore.getActiveInstance()?.id;

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
      if (typeof (window as any).InstanceStore === 'undefined') {
        console.warn('[OpenCode] InstanceStore not available');
        return;
      }

      context._updateInstanceUI();

      (window as any).InstanceStore.subscribe?.((event: any) => {
        if (event.type === 'instance:created' || event.type === 'instance:removed' || event.type === 'instance:active') {
          context._updateInstanceUI();
        }
      });
    },

    ensureInstanceExists() {
      if (typeof (window as any).InstanceStore === 'undefined') return;

      const instances = (window as any).InstanceStore.getInstancesArray() as InstanceInfo[];

      if (instances.length === 0 && context._workspace) {
        const instance = context._createInstance(context._workspace);
        if (instance) {
          (window as any).InstanceStore.setActiveInstance(instance.id);
          console.log('[OpenCode] Ensured instance exists for workspace:', context._workspace);
        }
      }
    },
  };
}
