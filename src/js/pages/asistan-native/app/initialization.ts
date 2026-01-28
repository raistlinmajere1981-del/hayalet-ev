/**
 * Initialization - App startup and component setup
 */

import type { InstanceInfo } from './types';

export function setupInitialization(context: any) {
  return {
    parseUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const serverUrl = params.get('server');
      if (serverUrl) {
        context._serverUrl = serverUrl;
      }

      const workspace = params.get('workspace');
      if (workspace) {
        context._workspace = workspace;
        sessionStorage.setItem('opencode-workspace', workspace);
      } else {
        context._workspace = sessionStorage.getItem('opencode-workspace');
      }
    },

    checkWorkspace() {
      if (!context._workspace) {
        console.log('[OpenCode] No workspace from URL, will load from activeProjects');
      } else {
        console.log('[OpenCode] Workspace from URL:', context._workspace);
      }
      return true;
    },

    async loadActiveProjects() {
      try {
        const activeProjects = await window.electronAPI?.opcGetActiveProjects?.() || [];

        console.log('[OpenCode] Loading active projects:', activeProjects);

        if (activeProjects.length === 0) {
          console.warn('[OpenCode] No active projects found');
          return;
        }

        if (!context._workspace) {
          const firstProject = activeProjects[0];
          context._workspace = typeof firstProject === 'string' ? firstProject : firstProject.folder;
          sessionStorage.setItem('opencode-workspace', context._workspace);
          console.log('[OpenCode] Set default workspace:', context._workspace);
        }

        for (const project of activeProjects) {
          const projectPath = typeof project === 'string' ? project : project.folder;
          if (typeof window.InstanceStore !== 'undefined') {
            const existing = (window.InstanceStore as any).findByFolder(projectPath);
            if (!existing) {
              const instance = (window.InstanceStore as any).createInstance({
                folder: projectPath,
                name: projectPath.split('/').pop() || projectPath.split('\\').pop() || 'Workspace',
                url: context._serverUrl || undefined,
              });
              (window.InstanceStore as any).setInstanceStatus(instance.id, 'disconnected');
              console.log('[OpenCode] Created instance for active project:', instance.name, '(disconnected)');
            }
          }
        }

        if (typeof window.InstanceStore !== 'undefined') {
          const instances = (window.InstanceStore as any).getInstancesArray() as InstanceInfo[];
          if (instances.length > 0 && !(window.InstanceStore as any).getActiveInstance()) {
            (window.InstanceStore as any).setActiveInstance(instances[0].id);
          }
        }
      } catch (err) {
        console.error('[OpenCode] Failed to load active projects:', err);
      }
    },

    initComponents() {
      // Instance Tabs
      context._initInstanceTabs();

      // Message Renderer
      const messagesList = document.getElementById('messages-list');
      if (messagesList) {
        (window as any).MessageRenderer.init(messagesList, { reactive: true });

        const messagesContainer = messagesList.closest('.messages-container') as HTMLElement | null;
        if (messagesContainer) {
          (window as any).MessageRenderer.initSmartScroll(messagesContainer);
          console.log('[OpenCode] Smart scroll initialized');
        }

        console.log('[OpenCode] MessageRenderer initialized with reactive mode');
      }

      // Sidebars
      context._initSidebars();

      // Command palette
      context._initCommandPalette();

      // Collapsible sections
      context._initCollapsibleSections();

      // Prompt Handler
      const promptInput = document.getElementById('prompt-input');
      const sendButton = document.getElementById('btn-send');
      if (promptInput && sendButton) {
        (window as any).PromptHandler.init({
          input: promptInput as HTMLTextAreaElement,
          sendButton: sendButton,
          onSend: (message: string) => context._handleSendMessage(message),
        });
      }

      // Permission & Question Modals
      if (typeof (window as any).PermissionModal !== 'undefined') {
        (window as any).PermissionModal.init();
        console.log('[OpenCode] PermissionModal initialized');
      }

      if (typeof (window as any).QuestionModal !== 'undefined') {
        (window as any).QuestionModal.init();
        console.log('[OpenCode] QuestionModal initialized');
      }

      // API Client URL
      (window as any).APIClient.setServerUrl(context._getServerUrl());

      // Agent/Model Selector
      if (typeof (window as any).AgentModelSelector !== 'undefined') {
        const modelSelectorBtn = document.getElementById('model-selector');
        const agentSelectorBtn = document.getElementById('agent-selector');

        (window as any).AgentModelSelector.initialize()
          .then(() => {
            console.log('[OpenCode] AgentModelSelector initialized');
            context._updateModelSelectorButton();
            context._updateAgentSelectorButton();
          })
          .catch((err: any) => {
            console.warn('[OpenCode] AgentModelSelector init error:', err);
          });

        if (modelSelectorBtn) {
          modelSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            context._openModelDropdown(modelSelectorBtn);
          });
        }

        if (agentSelectorBtn) {
          agentSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            context._openAgentDropdown(agentSelectorBtn);
          });
        }

        (window as any).AgentModelSelector.subscribe((event: any) => {
          if (event.type === 'model:changed' || event.type === 'selection:changed') {
            context._updateModelSelectorButton();
          }
          if (event.type === 'agent:changed' || event.type === 'selection:changed') {
            context._updateAgentSelectorButton();
          }
        });
      }
    },

    showApp() {
      const overlay = document.getElementById('loading-overlay');
      const app = document.getElementById('app');

      if (overlay) {
        overlay.classList.add('hidden');
      }

      if (app) {
        app.style.opacity = '1';
        app.style.pointerEvents = 'auto';
        app.classList.add('ready');
      }

      console.log('[OpenCode] App ready');
    },

    subscribeToSessionStore() {
      if (typeof (window as any).SessionStore === 'undefined') {
        console.warn('[OpenCode] SessionStore not available for subscription');
        return;
      }

      window.SessionStore?.subscribe?.((event: any) => {
        switch (event.type) {
          case 'session:changed':
          case 'session:usage:updated':
          case 'session:info:updated':
            context._updateTokenDisplay();
            break;
          case 'session:created':
          case 'session:updated':
            context._updateSessionList();
            break;
        }
      });

      if (typeof (window as any).MessageStore !== 'undefined') {
        window.MessageStore?.subscribe?.((event: any) => {
          if (event.type === 'part:updated' || event.type === 'message:updated') {
            if (context._tokenUpdateTimeout) {
              clearTimeout(context._tokenUpdateTimeout);
            }
            context._tokenUpdateTimeout = setTimeout(() => {
              context._updateTokenDisplay();
            }, 100);
          }
        });
      }

      context._updateTokenDisplay();
      console.log('[OpenCode] Subscribed to SessionStore');
    },

    initSessionBadgeTracking() {
      if (typeof (window as any).SessionStore === 'undefined') return;

      window.SessionStore?.subscribe?.(() => {
        context._updateSessionBadge();
      });

      context._updateSessionBadge();
      context._updateStatusPanel();
      context._statusPanelInterval = setInterval(() => {
        context._updateStatusPanel();
      }, 30000);
    },
  };
}
