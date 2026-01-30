/**
 * Prompt Handler Types
 */

export interface MentionResult {
  name: string;
  path?: string;
  type: string;
}

export interface CommandResult {
  name: string;
  description: string;
}

export interface PromptHandlerOptions {
  input?: HTMLTextAreaElement;
  sendButton?: HTMLElement;
  onSend?: (message: string) => void;
  onShellCommand?: (command: string) => void;
}

export interface TriggerMatch {
  query: string;
  atLineStart: boolean;
}

export interface AttachmentItem {
  type: string;
  mimeType?: string;
  size?: number;
  name: string;
  dataUrl?: string;
  content?: string;
  id: string;
}
