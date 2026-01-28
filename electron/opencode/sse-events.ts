/**
 * OpenCode Manager - SSE Event Handling
 * 
 * SSE stream management, event parsing, subscriptions
 */

import { eventParser, type NativeUIEvent } from "../opencode-event-parser.ts";
import { getApiUrl, getSSEHeaders } from './api-client.ts';

interface SSEReader {
  abort: () => void;
}

/**
 * SSE event stream'ine bağlan
 */
export function startSSEReader(
  port: number,
  authHeader: string | null,
  onEvent: (event: NativeUIEvent) => void
): SSEReader {
  const abortController = new AbortController();
  const reader: SSEReader = {
    abort: () => abortController.abort()
  };

  _startSSEReaderInternal(port, authHeader, onEvent, abortController).catch((err) => {
    console.log("[OPENCODE-SSE]", "error", "SSE reader error", { error: (err as Error).message });
  });

  return reader;
}

/**
 * SSE stream okuyucu (Node.js uyumlu)
 */
async function _startSSEReaderInternal(
  port: number,
  authHeader: string | null,
  onEvent: (event: NativeUIEvent) => void,
  abortController: AbortController
): Promise<void> {
  const url = `${getApiUrl(port)}/event`;
  console.log("[OPENCODE-SSE]", "info", "SSE bağlantısı kuruluyor", { url });

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getSSEHeaders(authHeader),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE bağlantısı başarısız: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Response body yok");
    }

    console.log("[OPENCODE-SSE]", "info", "SSE bağlantısı kuruldu");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log("[OPENCODE-SSE]", "info", "SSE stream sona erdi");
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // SSE standardı: \n\n ile ayrılmış event chunk'larını işle
      buffer = _flushSSEEvents(buffer, onEvent);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.log("[OPENCODE-SSE]", "debug", "SSE bağlantısı iptal edildi");
    } else {
      console.log("[OPENCODE-SSE]", "error", "SSE hatası", { error: (err as Error).message });
    }
  }
}

/**
 * SSE buffer'dan tam event'leri çıkar ve işle
 * CodeNomad flushEvents pattern'i - SSE standardı \n\n separator
 */
function _flushSSEEvents(buffer: string, onEvent: (event: NativeUIEvent) => void): string {
  let separatorIndex = buffer.indexOf("\n\n");

  while (separatorIndex >= 0) {
    const chunk = buffer.slice(0, separatorIndex);
    buffer = buffer.slice(separatorIndex + 2);
    _processSSEChunk(chunk, onEvent);
    separatorIndex = buffer.indexOf("\n\n");
  }

  return buffer;
}

/**
 * Tek bir SSE chunk'ını işle
 * Birden fazla data: satırını birleştirerek parse eder
 */
function _processSSEChunk(chunk: string, onEvent: (event: NativeUIEvent) => void): void {
  const lines = chunk.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    // Comment satırlarını atla
    if (line.startsWith(":")) {
      continue;
    }
    // data: ile başlayan satırları topla
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return;
  }

  // Tüm data satırlarını birleştir
  const payload = dataLines.join("\n").trim();
  if (!payload) {
    return;
  }

  try {
    const openCodeEvent = JSON.parse(payload);
    
    // DEBUG: Tool ve message event'lerini detaylı logla
    if (openCodeEvent.type?.includes('tool') || openCodeEvent.type?.includes('message')) {
      const props = openCodeEvent.properties || {};
      console.log("[OPENCODE-SSE]", "debug", "RAW EVENT FULL", { 
        type: openCodeEvent.type,
        messageId: props.id || props.messageId || openCodeEvent.messageId,
        role: props.role,
        partsCount: props.parts?.length || 0,
        partTypes: props.parts?.map((p: { type: string }) => p.type),
        partPreviews: props.parts?.map((p: { type: string; text?: string; content?: string }) => ({
          type: p.type,
          preview: (p.text || p.content || '').substring(0, 100)
        })),
        directContent: !props.parts ? {
          part: props.part,
          fullContent: props.fullContent?.substring?.(0, 100),
          role: props.role || openCodeEvent.role,
        } : null,
      });
    } else {
      console.log("[OPENCODE-SSE]", "debug", "Event parsed", { type: openCodeEvent.type });
    }
    
    const nativeEvent = eventParser.toNativeUIEvent(openCodeEvent);
    if (nativeEvent) {
      console.log("[OPENCODE-SSE]", "debug", "Dispatching event", { type: nativeEvent.type });
      onEvent(nativeEvent);
    }
  } catch (err) {
    console.log("[OPENCODE-SSE]", "warn", "SSE chunk parse hatası", { 
      error: (err as Error).message,
      payload: payload.substring(0, 200) 
    });
  }
}
