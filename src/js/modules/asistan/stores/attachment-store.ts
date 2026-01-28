/**
 * OpenCode UI - Attachment Store
 * 
 * Per-session attachment yönetimi.
 * File, image, text ve agent attachment türleri desteklenir.
 * 
 * CodeNomad pattern: getAttachments(instanceId, sessionId)
 */

interface AttachmentRecord {
  id: string;
  type: 'file' | 'image' | 'text' | 'agent';
  name: string;
  path?: string | null;
  content?: string | null;
  dataUrl?: string | null;
  mimeType?: string;
  size?: number;
  createdAt: number;
}

interface AttachmentInput {
  type: AttachmentRecord['type'];
  name?: string;
  path?: string;
  content?: string;
  dataUrl?: string;
  mimeType?: string;
  size?: number;
}

type AttachmentStoreEvent = {
  type: string;
  sessionId?: string;
  instanceId?: string;
  attachment?: AttachmentRecord;
  attachmentId?: string;
};

const AttachmentStore = {
  // =========================================================================
  // State
  // =========================================================================

  /** @type {Map<string, Map<string, AttachmentRecord[]>>} instanceId -> sessionId -> attachments */
  _attachments: new Map<string, Map<string, AttachmentRecord[]>>(),

  _listeners: new Set<(event: AttachmentStoreEvent) => void>(),

  /** @type {number} Max attachment size in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  /** @type {string[]} Allowed image MIME types */
  ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],

  /** @type {string[]} Allowed file extensions for code */
  CODE_EXTENSIONS: ['.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.cs', '.php', '.html', '.css', '.scss', '.json', '.yaml', '.yml', '.xml', '.md', '.sql', '.sh', '.bash'],

  // =========================================================================
  // Subscription
  // =========================================================================

  /**
   * Subscribe to attachment changes
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener: (event: AttachmentStoreEvent) => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  /**
   * Notify listeners of changes
   * @param {Object} event
   */
  _notify(event: AttachmentStoreEvent) {
    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[AttachmentStore] Listener error:', err);
      }
    });
  },

  // =========================================================================
  // Core API
  // =========================================================================

  /**
   * Get attachments for a session
   * @param {string} sessionId
   * @param {string} [instanceId='default']
   * @returns {AttachmentRecord[]}
   */
  getAttachments(sessionId: string, instanceId = 'default'): AttachmentRecord[] {
    const instanceMap = this._attachments.get(instanceId);
    if (!instanceMap) return [];
    return instanceMap.get(sessionId) || [];
  },

  /**
   * Add an attachment
   * @param {string} sessionId
   * @param {AttachmentInput} input
   * @param {string} [instanceId='default']
   * @returns {AttachmentRecord | null}
   */
  addAttachment(
    sessionId: string,
    input: AttachmentInput,
    instanceId = 'default'
  ): AttachmentRecord | null {
    // Validate input
    if (!input?.type) {
      console.warn('[AttachmentStore] Invalid attachment input:', input);
      return null;
    }

    // Get or create instance map
    if (!this._attachments.has(instanceId)) {
      this._attachments.set(instanceId, new Map());
    }
    const instanceMap = this._attachments.get(instanceId) as Map<string, AttachmentRecord[]>;

    // Get or create session attachments
    if (!instanceMap.has(sessionId)) {
      instanceMap.set(sessionId, []);
    }
    const attachments = instanceMap.get(sessionId) as AttachmentRecord[];

    // Check for duplicates (by path for files, by content hash for others)
    const isDuplicate = attachments.some((a) => {
      if (a.type === 'file' && input.type === 'file') {
        return a.path === input.path;
      }
      if (a.type === 'image' && input.type === 'image') {
        return a.dataUrl === input.dataUrl;
      }
      return false;
    });

    if (isDuplicate) {
      console.log('[AttachmentStore] Duplicate attachment skipped:', input.name || input.path);
      return null;
    }

    // Create attachment record
    const attachment: AttachmentRecord = {
      id: this._generateId(),
      type: input.type,
      name: input.name || this._extractFileName(input.path) || 'Untitled',
      path: input.path || null,
      content: input.content || null,
      dataUrl: input.dataUrl || null,
      mimeType: input.mimeType || this._detectMimeType(input),
      size: input.size || (input.content?.length || 0),
      createdAt: Date.now(),
    };

    attachments.push(attachment);

    this._notify({
      type: 'attachment:added',
      sessionId,
      instanceId,
      attachment,
    });

    console.log('[AttachmentStore] Added:', attachment.type, attachment.name);
    return attachment;
  },

  /**
   * Remove an attachment by ID
   * @param {string} sessionId
   * @param {string} attachmentId
   * @param {string} [instanceId='default']
   * @returns {boolean}
   */
  removeAttachment(sessionId: string, attachmentId: string, instanceId = 'default'): boolean {
    const instanceMap = this._attachments.get(instanceId);
    if (!instanceMap) return false;

    const attachments = instanceMap.get(sessionId);
    if (!attachments) return false;

    const index = attachments.findIndex((a) => a.id === attachmentId);
    if (index === -1) return false;

    const [removed] = attachments.splice(index, 1);

    this._notify({
      type: 'attachment:removed',
      sessionId,
      instanceId,
      attachmentId,
      attachment: removed,
    });

    console.log('[AttachmentStore] Removed:', removed.name);
    return true;
  },

  /**
   * Clear all attachments for a session
   * @param {string} sessionId
   * @param {string} [instanceId='default']
   */
  clearAttachments(sessionId: string, instanceId = 'default') {
    const instanceMap = this._attachments.get(instanceId);
    if (!instanceMap) return;

    const attachments = instanceMap.get(sessionId);
    if (!attachments || attachments.length === 0) return;

    instanceMap.set(sessionId, []);

    this._notify({
      type: 'attachments:cleared',
      sessionId,
      instanceId,
    });

    console.log('[AttachmentStore] Cleared attachments for session:', sessionId);
  },

  /**
   * Get attachment count for a session
   * @param {string} sessionId
   * @param {string} [instanceId='default']
   * @returns {number}
   */
  getAttachmentCount(sessionId: string, instanceId = 'default') {
    return this.getAttachments(sessionId, instanceId).length;
  },

  // =========================================================================
  // File Helpers
  // =========================================================================

  /**
   * Add file attachment from File object
   * @param {string} sessionId
   * @param {File} file
   * @param {string} [instanceId='default']
   * @returns {Promise<AttachmentRecord | null>}
   */
  async addFileAttachment(sessionId: string, file: File, instanceId = 'default') {
    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      console.warn('[AttachmentStore] File too large:', file.name, file.size);
      return null;
    }

    // Check if it's an image
    if (this.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return this.addImageAttachment(sessionId, file, instanceId);
    }

    // Read file content for text files
    const isTextFile = this._isTextFile(file.name);
    let content: string | null = null;

    if (isTextFile && file.size < 100 * 1024) { // Only read content for files < 100KB
      try {
        content = await file.text();
      } catch (err) {
        console.warn('[AttachmentStore] Could not read file content:', err);
        content = null;
      }
    }

    return this.addAttachment(sessionId, {
      type: 'file',
      name: file.name,
      path: file.name, // Relative path, actual path not available in browser
      content: content ?? undefined,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }, instanceId);
  },

  /**
   * Add image attachment from File or Blob
   * @param {string} sessionId
   * @param {File | Blob} imageData
   * @param {string} [instanceId='default']
   * @returns {Promise<AttachmentRecord | null>}
   */
  async addImageAttachment(sessionId: string, imageData: File | Blob, instanceId = 'default') {
    try {
      const dataUrl = await this._fileToDataUrl(imageData);
      const name = imageData instanceof File ? imageData.name : `image-${Date.now()}.png`;

      return this.addAttachment(sessionId, {
        type: 'image',
        name,
        dataUrl,
        mimeType: imageData.type || 'image/png',
        size: imageData.size,
      }, instanceId);
    } catch (err) {
      console.error('[AttachmentStore] Failed to add image:', err);
      return null;
    }
  },

  /**
   * Add text/code snippet attachment
   * @param {string} sessionId
   * @param {string} content
   * @param {string} [name]
   * @param {string} [instanceId='default']
   * @returns {AttachmentRecord | null}
   */
  addTextAttachment(sessionId: string, content: string, name?: string, instanceId = 'default') {
    return this.addAttachment(sessionId, {
      type: 'text',
      name: name || `snippet-${Date.now()}.txt`,
      content,
      mimeType: 'text/plain',
      size: content.length,
    }, instanceId);
  },

  // =========================================================================
  // Clipboard/Paste Support
  // =========================================================================

  /**
   * Handle paste event and extract attachments
   * @param {ClipboardEvent} event
   * @param {string} sessionId
   * @param {string} [instanceId='default']
   * @returns {Promise<AttachmentRecord[]>}
   */
  async handlePaste(event: ClipboardEvent, sessionId: string, instanceId = 'default') {
    const items = event.clipboardData?.items;
    if (!items) return [];

    const attachments: AttachmentRecord[] = [];

    for (const item of items) {
      // Handle image paste
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          const attachment = await this.addImageAttachment(sessionId, blob, instanceId);
          if (attachment) {
            attachments.push({
              ...attachment,
              path: attachment.path ?? undefined,
              content: attachment.content ?? undefined,
              dataUrl: attachment.dataUrl ?? undefined,
            });
          }
        }
      }
      // Handle file paste
      else if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          const attachment = await this.addFileAttachment(sessionId, file, instanceId);
          if (attachment) {
            attachments.push({
              ...attachment,
              path: attachment.path ?? undefined,
              content: attachment.content ?? undefined,
              dataUrl: attachment.dataUrl ?? undefined,
            });
          }
        }
      }
    }

    return attachments;
  },

  // =========================================================================
  // Drag & Drop Support
  // =========================================================================

  /**
   * Handle drop event and extract attachments
   * @param {DragEvent} event
   * @param {string} sessionId
   * @param {string} [instanceId='default']
   * @returns {Promise<AttachmentRecord[]>}
   */
  async handleDrop(event: DragEvent, sessionId: string, instanceId = 'default') {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return [];

    const attachments: AttachmentRecord[] = [];

    for (const file of files) {
      const attachment = await this.addFileAttachment(sessionId, file, instanceId);
      if (attachment) {
        // Convert null to undefined for optional fields
        attachments.push({
          ...attachment,
          path: attachment.path ?? undefined,
          content: attachment.content ?? undefined,
          dataUrl: attachment.dataUrl ?? undefined,
        });
      }
    }

    return attachments;
  },

  // =========================================================================
  // Serialization (for sending to API)
  // =========================================================================

  /**
   * Get attachments in API-ready format
   * @param {string} sessionId
   * @param {string} [instanceId='default']
   * @returns {Array<Record<string, unknown>>}
  getAttachmentsForAPI(sessionId: string, instanceId = 'default') {
    const attachments = this.getAttachments(sessionId, instanceId);

    return attachments
      .map((attachment) => {
        if (attachment.type === 'image') {
          return {
            type: 'image',
            name: attachment.name,
            data: attachment.dataUrl ?? undefined,
            mimeType: attachment.mimeType,
          };
        }
        if (attachment.type === 'file' || attachment.type === 'text') {
          return {
            type: 'file',
            name: attachment.name,
            path: attachment.path ?? undefined,
            content: attachment.content ?? undefined,
            mimeType: attachment.mimeType,
          };
        }
        return null;
      })
      .filter((value): value is Record<string, unknown> => Boolean(value));
  }
  },

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Generate unique attachment ID
   * @returns {string}
   */
  _generateId() {
    return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Extract filename from path
   * @param {string} path
   * @returns {string}
   */
  _extractFileName(path: string | null | undefined) {
    if (!path) return '';
    return path.split('/').pop()?.split('\\').pop() || path;
  },

  /**
   * Detect MIME type from attachment
   * @param {AttachmentInput} input
   * @returns {string}
   */
  _detectMimeType(input: AttachmentInput) {
    if (input.mimeType) return input.mimeType;

    const name = input.name || input.path || '';
    const ext = name.split('.').pop()?.toLowerCase();

    const mimeMap = {
      js: 'text/javascript',
      ts: 'text/typescript',
      tsx: 'text/typescript',
      jsx: 'text/javascript',
      json: 'application/json',
      html: 'text/html',
      css: 'text/css',
      md: 'text/markdown',
      py: 'text/x-python',
      rb: 'text/x-ruby',
      go: 'text/x-go',
      rs: 'text/x-rust',
      java: 'text/x-java',
      sh: 'text/x-shellscript',
      yaml: 'text/yaml',
      yml: 'text/yaml',
      xml: 'application/xml',
      sql: 'text/x-sql',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };

    return (ext && mimeMap[ext as keyof typeof mimeMap]) || 'application/octet-stream';
  },

  /**
   * Check if file is a text file based on extension
   * @param {string} filename
   * @returns {boolean}
   */
  _isTextFile(filename: string) {
    const ext = '.' + (filename.split('.').pop()?.toLowerCase() || '');
    return this.CODE_EXTENSIONS.includes(ext) ||
      ['.txt', '.log', '.csv', '.env', '.gitignore', '.dockerignore'].includes(ext);
  },

  /**
   * Convert File/Blob to data URL
   * @param {File | Blob} file
   * @returns {Promise<string>}
   */
  _fileToDataUrl(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};

// ES6 Export
export { AttachmentStore };

// Global export (backward compatibility)
window.AttachmentStore = AttachmentStore;
