/**
 * Render Helpers
 * Tool card, input, output, and status rendering
 */

import type { ToolRendererConfig, ToolCallData } from './types.js';

function createRenderHelpers(
  getRendererFn: (toolName: string) => ToolRendererConfig | undefined,
  defaultRendererFn: ToolRendererConfig | undefined,
  executeHooksFn: (toolName: string, hookType: string, data: unknown) => void,
  escapeHtmlFn: (text: string) => string,
  defaultRenderInputFn: (input: unknown) => string,
  defaultRenderOutputFn: (output: string) => string
) {
  return {
    /**
     * Render tool card with appropriate renderer
     */
    renderToolCard(toolCall: ToolCallData) {
      // Execute beforeRender hooks
      executeHooksFn(toolCall.toolName || '', 'beforeRender', { toolCall });

      const renderer = getRendererFn(toolCall.toolName || '') || defaultRendererFn;
      let card;

      if (renderer?.renderCard) {
        card = renderer.renderCard(toolCall);
      } else {
        // Fallback to default ToolRenderer
        card =
          window.ToolRenderer?.createToolCard
            ? window.ToolRenderer.createToolCard(toolCall)
            : document.createElement('div');
      }

      // Execute afterRender hooks
      executeHooksFn(toolCall.toolName || '', 'afterRender', { toolCall, element: card });

      return card;
    },

    /**
     * Update tool status and execute hooks
     */
    updateStatus(toolCall: ToolCallData, newStatus: string) {
      const oldStatus = toolCall.status;
      toolCall.status = newStatus;

      // Execute status change hooks
      executeHooksFn(toolCall.toolName || '', 'onStatusChange', {
        toolCall,
        oldStatus,
        newStatus,
      });
    },

    /**
     * Render tool input with appropriate renderer
     */
    renderInput(toolCall: ToolCallData) {
      const renderer = getRendererFn(toolCall.toolName || '');

      if (renderer?.renderInput) {
        return renderer.renderInput(toolCall.input, toolCall);
      }

      // Default JSON rendering
      return defaultRenderInputFn(toolCall.input);
    },

    /**
     * Render tool output with appropriate renderer
     */
    renderOutput(toolCall: ToolCallData) {
      const renderer = getRendererFn(toolCall.toolName || '');

      if (renderer?.renderOutput) {
        return renderer.renderOutput(toolCall.output || '', toolCall);
      }

      // Default output rendering with ANSI support
      return defaultRenderOutputFn(toolCall.output || '');
    },

    /**
     * Check if tool should auto-collapse
     */
    shouldAutoCollapse(toolCall: ToolCallData) {
      const renderer = getRendererFn(toolCall.toolName || '');

      if (renderer?.shouldAutoCollapse) {
        return renderer.shouldAutoCollapse(toolCall);
      }

      // Default: collapse successful tools with large output
      return toolCall.status === 'success' && (toolCall.output?.length || 0) > 500;
    },

    /**
     * Get renderer for a tool
     */
    get(toolName: string) {
      return getRendererFn(toolName) || defaultRendererFn;
    },

    /**
     * Check if tool has custom renderer
     */
    has(toolName: string) {
      return getRendererFn(toolName) !== undefined;
    },
  };
}

export { createRenderHelpers };
