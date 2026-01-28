/**
 * Tool Renderer Registry Types
 */

export interface ToolRendererConfig {
  name?: string;
  icon?: string;
  label?: string;
  renderCard?: (toolCall: ToolCallData) => HTMLElement;
  renderInput?: (input: unknown, toolCall: ToolCallData) => string;
  renderOutput?: (output: string, toolCall: ToolCallData) => string;
  shouldAutoCollapse?: (toolCall: ToolCallData) => boolean;
}

export interface ToolCallData {
  toolId?: string;
  toolName?: string;
  status?: string;
  input?: unknown;
  output?: string;
}

export type HookType = 'beforeRender' | 'afterRender' | 'onStatusChange';
export type HookCallback = (data: unknown) => void;
export type RegistryListener = (event: unknown) => void;

export interface RegistryEvent {
  type: string;
  toolName?: string;
  [key: string]: unknown;
}
