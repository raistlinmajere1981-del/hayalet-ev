/**
 * Initialization - App startup and component setup
 */

import type { InstanceInfo, AppContext } from './types';

export function setupInitialization(context: AppContext) {
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
          if (firstProject) {
            context._workspace = typeof firstProject === 'string' ? firstProject : ((firstProject as { folder: string } | undefined)?.folder || null);
            if (context._workspace && typeof context._workspace === 'string') {
              sessionStorage.setItem('opencode-workspace', context._workspace);
              console.log('[OpenCode] Set default workspace:', context._workspace);
            }
          }
        }

        for (const project of activeProjects) {
          const projectPath = typeof project === 'string' ? project : (project as { folder: string }).folder;
          if (typeof window.InstanceStore !== 'undefined') {
            const existing = window.InstanceStore?.findByFolder?.(projectPath);
            if (!existing) {
              const instance = window.InstanceStore?.createInstance?.({
                folder: projectPath,
                name: projectPath.split('/').pop() || projectPath.split('\\').pop() || 'Workspace',
                url: (context._serverUrl as string | undefined) || undefined,
              });
              if (instance) {
                window.InstanceStore?.setInstanceStatus?.(instance.id, 'disconnected');
              }
            }
          }
        }

        if (typeof window.InstanceStore !== 'undefined') {
          const instances = window.InstanceStore?.getInstancesArray?.() as InstanceInfo[];
          const firstInstance = instances[0];
          if (instances.length > 0 && !window.InstanceStore?.getActiveInstance?.() && firstInstance) {
            window.InstanceStore?.setActiveInstance?.(firstInstance.id);
          }
        }
      } catch (error) {
        console.error('[OpenCode] Error loading projects:', error);
      }
    },

    initComponents() {
      // Instance Tabs
      context._initInstanceTabs();

      // Message Renderer
      const messagesList = document.getElementById('messages-list');
      if (messagesList) {
        (window.MessageRenderer as any)?.init?.(messagesList, { reactive: true });

        const messagesContainer = messagesList.closest('.messages-container') as HTMLElement | null;
        if (messagesContainer) {
          (window.MessageRenderer as any)?.initSmartScroll?.(messagesContainer);
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
        (window.PromptHandler as any)?.init?.({
          input: promptInput as HTMLTextAreaElement,
          sendButton: sendButton,
          onSend: (message: string) => (context as any)._handleSendMessage(message),
        });
      }

      // Permission & Question Modals
      if (typeof window.PermissionModal !== 'undefined') {
        (window.PermissionModal as any)?.init?.();
        console.log('[OpenCode] PermissionModal initialized');
      }

      if (typeof window.QuestionModal !== 'undefined') {
        (window.QuestionModal as any)?.init?.();
        console.log('[OpenCode] QuestionModal initialized');
      }

      // API Client URL
      window.APIClient?.setServerUrl?.(context._getServerUrl());

      // Agent/Model Selector
      if (typeof window.AgentModelSelector !== 'undefined') {
        const modelSelectorBtn = document.getElementById('model-selector');
        const agentSelectorBtn = document.getElementById('agent-selector');

        window.AgentModelSelector?.initialize?.()
          .then(() => {
            console.log('[OpenCode] AgentModelSelector initialized');
            context._updateModelSelectorButton();
            context._updateAgentSelectorButton();
          })
          .catch((err: unknown) => {
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

        window.AgentModelSelector?.subscribe?.((event: unknown) => {
          const evt = event as any;
          if (evt.type === 'model:changed' || evt.type === 'selection:changed') {
            context._updateModelSelectorButton();
          }
          if (evt.type === 'agent:changed' || evt.type === 'selection:changed') {
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
      if (typeof window.SessionStore === 'undefined') {
        console.warn('[OpenCode] SessionStore not available for subscription');
        return;
      }

      window.SessionStore?.subscribe?.((event) => {
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

      if (typeof window.MessageStore !== 'undefined') {
        window.MessageStore?.subscribe?.((event: unknown) => {
          const evt = event as any;
          if (evt.type === 'part:updated' || evt.type === 'message:updated') {
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
      if (typeof window.SessionStore === 'undefined') return;

      window.SessionStore?.subscribe?.(() => {
        (context as any)._updateSessionBadge();
      });

      (context as any)._updateSessionBadge();
      (context as any)._updateStatusPanel();
      context._statusPanelInterval = setInterval(() => {
        context._updateStatusPanel();
      }, 30000);
    },
  };
}