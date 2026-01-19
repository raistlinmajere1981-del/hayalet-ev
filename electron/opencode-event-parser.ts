/**
 * OpenCode Event Parser
 *
 * OpenCode HTTP API'den gelen SSE event'lerini parse edip
 * Native UI SSE Server formatına dönüştürür.
 *
 * @module opencode-event-parser
 */

// LogManager electron'da console.log kullanıyor
const log = (source: string, level: string, message: string) => {
  console.log(`[${source}]`, level, message);
};

// OpenCode API Event Types
export interface OpenCodeEvent {
  type: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

// Message Events
export interface MessagePart {
  type: "text" | "tool_call" | "tool_result";
  text?: string;
  toolCall?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  toolResult?: {
    id: string;
    content: string;
    isError?: boolean;
  };
}

export interface OpenCodeMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  metadata?: {
    time?: { created?: number; completed?: number };
    model?: string;
    cost?: { input: number; output: number; total: number };
  };
}

// Tool Events
export interface ToolStartEvent {
  sessionId: string;
  messageId: string;
  toolId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface ToolEndEvent {
  sessionId: string;
  messageId: string;
  toolId: string;
  toolName: string;
  output?: string;
  isError?: boolean;
}

// Permission Events
export interface PermissionRequestEvent {
  sessionId: string;
  permissionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  message?: string;
}

// Session Events
export interface SessionUpdatedEvent {
  id: string;
  status: "idle" | "processing" | "waiting_permission" | "waiting_answer";
  title?: string;
}

// SSE Server Event Format (Native UI'a gönderilecek)
export interface NativeUIEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * OpenCode event'lerini Native UI formatına dönüştürür
 */
export class OpenCodeEventParser {
  private static instance: OpenCodeEventParser;

  private constructor() {}

  static getInstance(): OpenCodeEventParser {
    if (!OpenCodeEventParser.instance) {
      OpenCodeEventParser.instance = new OpenCodeEventParser();
    }
    return OpenCodeEventParser.instance;
  }

  /**
   * OpenCode SSE line'ını parse eder
   * Format: "event: <type>\ndata: <json>"
   */
  parseSSELine(line: string): OpenCodeEvent | null {
    if (!line || line.startsWith(":")) {
      // Comment veya empty line
      return null;
    }

    try {
      // "data: {...}" formatını parse et
      if (line.startsWith("data:")) {
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) return null;
        return JSON.parse(jsonStr) as OpenCodeEvent;
      }

      // Bazı event'ler direkt JSON olabilir
      if (line.startsWith("{")) {
        return JSON.parse(line) as OpenCodeEvent;
      }

      return null;
    } catch (err) {
      log("opencode-parser", "warn", `SSE parse error: ${err instanceof Error ? err.message : "Unknown"}`);
      return null;
    }
  }

  /**
   * OpenCode event'ini Native UI formatına dönüştürür
   */
  toNativeUIEvent(event: OpenCodeEvent): NativeUIEvent | null {
    const timestamp = Date.now();

    switch (event.type) {
      // Message Events
      case "message.created":
        return this._handleMessageCreated(event, timestamp);

      case "message.updated":
        return this._handleMessageUpdated(event, timestamp);

      case "message.completed":
        return this._handleMessageCompleted(event, timestamp);

      // Tool Events
      case "tool.start":
        return this._handleToolStart(event, timestamp);

      case "tool.end":
        return this._handleToolEnd(event, timestamp);

      // Permission Events
      case "permission.request":
        return this._handlePermissionRequest(event, timestamp);

      case "permission.resolved":
        return this._handlePermissionResolved(event, timestamp);

      // Session Events
      case "session.updated":
        return this._handleSessionUpdated(event, timestamp);

      case "session.completed":
        return this._handleSessionCompleted(event, timestamp);

      // Text Delta (streaming)
      case "text.delta":
      case "content.delta":
        return this._handleTextDelta(event, timestamp);

      // Message Part Updated (OpenCode gerçek format)
      case "message.part.updated":
        return this._handleMessagePartUpdated(event, timestamp);

      // Session Events
      case "session.status":
        return {
          type: "status.change",
          data: { status: event.properties?.status || event.status },
          timestamp,
        };

      case "session.diff":
        // Session diff - genelde ignore edilebilir
        return null;

      case "session.idle":
        return {
          type: "status.change",
          data: { status: "idle" },
          timestamp,
        };

      // Server Events
      case "server.heartbeat":
        // Heartbeat - ignore
        return null;

      case "server.connected":
        return {
          type: "status.change",
          data: { status: "connected" },
          timestamp,
        };

      // Thinking/Reasoning
      case "thinking.start":
      case "reasoning.start":
        return {
          type: "thinking.start",
          data: { messageId: event.messageId },
          timestamp,
        };

      case "thinking.delta":
      case "reasoning.delta":
        return {
          type: "thinking.delta",
          data: {
            messageId: event.messageId,
            content: event.content || event.text || "",
          },
          timestamp,
        };

      case "thinking.end":
      case "reasoning.end":
        return {
          type: "thinking.end",
          data: { messageId: event.messageId },
          timestamp,
        };

      // Error
      case "error":
        return {
          type: "error",
          data: {
            message: event.message || event.error || "Unknown error",
            code: event.code,
          },
          timestamp,
        };

      default:
        // Bilinmeyen event tiplerini log'la ama geçir
        log("opencode-parser", "debug", `Unknown event type: ${event.type}`);
        return {
          type: event.type,
          data: event.properties || event,
          timestamp,
        };
    }
  }

  // Private handlers

  private _handleMessageCreated(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    const msg = event.properties as unknown as OpenCodeMessage;
    return {
      type: "message.created",
      data: {
        id: msg?.id || event.messageId || crypto.randomUUID(),
        role: msg?.role || event.role || "assistant",
        content: this._extractTextFromParts(msg?.parts || []),
        parts: msg?.parts || [],
      },
      timestamp,
    };
  }

  private _handleMessageUpdated(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    const msg = event.properties as unknown as OpenCodeMessage;
    return {
      type: "message.delta",
      data: {
        id: msg?.id || event.messageId,
        content: this._extractTextFromParts(msg?.parts || []),
        parts: msg?.parts || [],
      },
      timestamp,
    };
  }

  private _handleMessageCompleted(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    const msg = event.properties as unknown as OpenCodeMessage;
    return {
      type: "message.completed",
      data: {
        id: msg?.id || event.messageId,
        content: this._extractTextFromParts(msg?.parts || []),
        parts: msg?.parts || [],
        metadata: msg?.metadata,
      },
      timestamp,
    };
  }

  private _handleToolStart(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    const tool = event.properties as unknown as ToolStartEvent;
    return {
      type: "tool.start",
      data: {
        toolId: tool?.toolId || event.toolId || crypto.randomUUID(),
        toolName: tool?.toolName || event.toolName || "unknown",
        toolInput: tool?.toolInput || event.toolInput || {},
        messageId: tool?.messageId || event.messageId,
      },
      timestamp,
    };
  }

  private _handleToolEnd(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    const tool = event.properties as unknown as ToolEndEvent;
    return {
      type: "tool.end",
      data: {
        toolId: tool?.toolId || event.toolId,
        toolName: tool?.toolName || event.toolName,
        output: tool?.output || event.output || "",
        isError: tool?.isError || event.isError || false,
        messageId: tool?.messageId || event.messageId,
      },
      timestamp,
    };
  }

  private _handlePermissionRequest(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    const perm = event.properties as unknown as PermissionRequestEvent;
    return {
      type: "permission.request",
      data: {
        permissionId: perm?.permissionId || event.permissionId,
        toolName: perm?.toolName || event.toolName,
        toolInput: perm?.toolInput || event.toolInput || {},
        message:
          perm?.message ||
          event.message ||
          `Tool "${perm?.toolName || event.toolName}" izin istiyor`,
        sessionId: perm?.sessionId || event.sessionId,
      },
      timestamp,
    };
  }

  private _handlePermissionResolved(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    return {
      type: "permission.resolved",
      data: {
        permissionId: event.permissionId,
        approved: event.approved,
      },
      timestamp,
    };
  }

  private _handleSessionUpdated(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    const session = event.properties as unknown as SessionUpdatedEvent;
    return {
      type: "session.updated",
      data: {
        id: session?.id || event.sessionId,
        status: session?.status || event.status || "idle",
        title: session?.title || event.title,
      },
      timestamp,
    };
  }

  private _handleSessionCompleted(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    return {
      type: "session.completed",
      data: {
        sessionId: event.sessionId,
      },
      timestamp,
    };
  }

  private _handleTextDelta(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent {
    return {
      type: "message.delta",
      data: {
        id: event.messageId,
        delta: event.content || event.text || event.delta || "",
      },
      timestamp,
    };
  }

  /**
   * Message parts'tan text içeriği çıkarır
   */
  private _extractTextFromParts(parts: MessagePart[]): string {
    return parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("");
  }

  /**
   * OpenCode message.part.updated event'ini işle
   * Bu event mesaj içeriği güncellendiğinde gelir
   */
  private _handleMessagePartUpdated(
    event: OpenCodeEvent,
    timestamp: number
  ): NativeUIEvent | null {
    const props = event.properties as Record<string, unknown> || {};
    const part = props.part as Record<string, unknown> || {};
    const partType = part.type as string;
    
    // Text part
    if (partType === "text") {
      const text = part.text as string || "";
      // Boş text'i atla
      if (!text.trim()) return null;
      
      return {
        type: "message.delta",
        data: {
          id: props.messageId || event.messageId,
          content: text,
          delta: text,
        },
        timestamp,
      };
    }
    
    // Step-start, step-finish gibi metadata part'larını atla
    if (partType === "step-start" || partType === "step-finish") {
      return null;
    }
    
    // Thinking/Reasoning part
    if (partType === "thinking" || partType === "reasoning") {
      const thinking = part.thinking as string || part.reasoning as string || "";
      return {
        type: "thinking.delta",
        data: {
          messageId: props.messageId || event.messageId,
          content: thinking,
        },
        timestamp,
      };
    }
    
    // Tool call part
    if (partType === "tool-invocation" || partType === "tool_call") {
      const toolState = part.state as string || part.toolState as string;
      const toolName = part.toolName as string || "";
      const toolId = part.id as string || part.toolId as string || "";
      const toolInput = part.input as Record<string, unknown> || {};
      const toolOutput = part.output as string || part.result as string || "";
      
      if (toolState === "pending" || toolState === "running") {
        return {
          type: "tool.start",
          data: {
            toolId,
            toolName,
            toolInput,
            messageId: props.messageId || event.messageId,
          },
          timestamp,
        };
      } else if (toolState === "completed" || toolState === "done") {
        return {
          type: "tool.end",
          data: {
            toolId,
            toolName,
            output: toolOutput,
            isError: false,
            messageId: props.messageId || event.messageId,
          },
          timestamp,
        };
      } else if (toolState === "error" || toolState === "failed") {
        return {
          type: "tool.end",
          data: {
            toolId,
            toolName,
            output: toolOutput || "Tool execution failed",
            isError: true,
            messageId: props.messageId || event.messageId,
          },
          timestamp,
        };
      }
    }
    
    // Tool part - tool event'e dönüştür, message content'e ekleme
    if (partType === "tool") {
      const toolState = part.state as Record<string, unknown> || {};
      const status = toolState.status as string;
      const toolName = part.tool as string || "";
      const toolId = part.callID as string || part.id as string || "";
      const input = toolState.input as Record<string, unknown> || {};
      const output = toolState.output as string || "";
      
      if (status === "pending" || status === "running") {
        return {
          type: "tool.start",
          data: {
            toolId,
            toolName,
            toolInput: input,
            messageId: props.messageId || event.messageId,
          },
          timestamp,
        };
      } else if (status === "completed") {
        return {
          type: "tool.end",
          data: {
            toolId,
            toolName,
            output,
            isError: false,
            messageId: props.messageId || event.messageId,
          },
          timestamp,
        };
      }
      return null; // Diğer tool state'leri atla
    }
    
    // Diğer metadata part tiplerini atla (JSON gibi görünenler)
    const content = JSON.stringify(part);
    if (content.startsWith('{"id":"') || content.includes('"type":"step-')) {
      return null;
    }
    
    // Gerçekten bilinmeyen part tipleri için log
    log("opencode-parser", "debug", `Unknown part type: ${partType}`);
    return null;
  }
}

// Singleton export
export const eventParser = OpenCodeEventParser.getInstance();
