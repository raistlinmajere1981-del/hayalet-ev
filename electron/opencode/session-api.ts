/**
 * OpenCode Manager - Session API
 * 
 * Session management, messaging, permissions, cancellation
 */

import { createId } from './id-generator.ts';
import { getApiUrl, getHeaders } from './api-client.ts';
import { API_TIMEOUT } from './types.ts';
import type { ApiResponse, OpenCodeSession } from './types.ts';

/**
 * Session listesini al
 */
export async function getSessions(
  port: number,
  authHeader: string | null
): Promise<ApiResponse<OpenCodeSession[]>> {
  try {
    const response = await fetch(`${getApiUrl(port)}/session`, {
      method: "GET",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { sessions?: OpenCodeSession[] };
    return { success: true, data: data.sessions || (data as unknown as OpenCodeSession[]) };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "getSessions hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Belirli bir session'ı ID ile al
 */
export async function getSessionById(
  port: number,
  authHeader: string | null,
  sessionId: string
): Promise<ApiResponse<OpenCodeSession>> {
  try {
    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}`, {
      method: "GET",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "Session not found" };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { session?: OpenCodeSession } | OpenCodeSession;
    const session = (data as { session?: OpenCodeSession }).session || (data as OpenCodeSession);
    return { success: true, data: session };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "getSessionById hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Session mesajlarını al
 */
export async function getSessionMessages(
  port: number,
  authHeader: string | null,
  sessionId: string
): Promise<ApiResponse<Array<{ role: string; content: string; id?: string }>>> {
  try {
    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}/messages`, {
      method: "GET",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: true, data: [] };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { messages?: Array<{ role: string; content: string; id?: string }> };
    return { success: true, data: data.messages || [] };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "getSessionMessages hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Yeni session oluştur veya mevcut session'a bağlan
 */
export async function createOrGetSession(
  port: number,
  authHeader: string | null,
  path?: string,
  _currentSessionId?: string | null
): Promise<ApiResponse<OpenCodeSession>> {
  try {
    // Önce mevcut session'ları kontrol et
    const sessionsResult = await getSessions(port, authHeader);
    if (sessionsResult.success && sessionsResult.data && sessionsResult.data.length > 0) {
      const targetPath = path || process.cwd();
      const existingSession = sessionsResult.data.find(s => s.path === targetPath);
      
      if (existingSession) {
        console.log("[OPENCODE-API]", "info", "Mevcut session bulundu", { id: existingSession.id });
        return { success: true, data: existingSession };
      }
    }

    // Yeni session oluştur
    const response = await fetch(`${getApiUrl(port)}/session`, {
      method: "POST",
      headers: getHeaders(authHeader),
      body: JSON.stringify({ path: path || process.cwd() }),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { session?: OpenCodeSession };
    const session = data.session || (data as unknown as OpenCodeSession);
    
    console.log("[OPENCODE-API]", "info", "Yeni session oluşturuldu", { id: session.id });
    return { success: true, data: session };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "createOrGetSession hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Mesaj gönder (async - streaming response için)
 */
export async function sendMessage(
  port: number,
  authHeader: string | null,
  message: string,
  sessionId?: string,
  messageId?: string
): Promise<ApiResponse<{ messageId: string }>> {
  let sid = sessionId;
  
  // Session yoksa otomatik oluştur
  if (!sid) {
    console.log("[OPENCODE-API]", "info", "Session yok, otomatik oluşturuluyor...");
    const sessionResult = await createOrGetSession(port, authHeader);
    if (!sessionResult.success || !sessionResult.data?.id) {
      return { success: false, error: "Session oluşturulamadı: " + (sessionResult.error || "Bilinmeyen hata") };
    }
    sid = sessionResult.data.id;
    console.log("[OPENCODE-API]", "info", "Session oluşturuldu", { sessionId: sid });
  }

  try {
    const msgId = messageId || createId("msg");
    const partId = createId("part");
    
    console.log("[OPENCODE-API]", "debug", "Mesaj gönderiliyor", { 
      sessionId: sid, 
      messageId: msgId,
      partId,
      messageLength: message.length 
    });
    
    const body: Record<string, unknown> = {
      messageID: msgId,
      parts: [
        { id: partId, type: "text", text: message }
      ],
    };
    
    console.log("[OPENCODE-API]", "debug", "prompt_async REQUEST BODY", JSON.stringify(body, null, 2));
    
    const response = await fetch(`${getApiUrl(port)}/session/${sid}/prompt_async`, {
      method: "POST",
      headers: getHeaders(authHeader),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    if (response.status === 204) {
      console.log("[OPENCODE-API]", "info", "Mesaj gönderildi (async)", { messageId: msgId });
      return { success: true, data: { messageId: msgId } };
    }

    const data = await response.json() as { messageId?: string; id?: string };
    const finalMessageId = data.messageId || data.id || msgId;
    console.log("[OPENCODE-API]", "info", "Mesaj gönderildi", { messageId: finalMessageId });
    
    return { success: true, data: { messageId: finalMessageId } };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "sendMessage hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Permission isteğine yanıt ver
 */
export async function respondToPermission(
  port: number,
  authHeader: string | null,
  sessionId: string,
  permissionId: string,
  approved: boolean
): Promise<ApiResponse<void>> {
  if (!sessionId) {
    return { success: false, error: "Session ID gerekli" };
  }

  try {
    console.log("[OPENCODE-API]", "debug", "Permission yanıtı gönderiliyor", { 
      sessionId, 
      permissionId, 
      approved 
    });
    
    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}/permissions/${permissionId}`, {
      method: "POST",
      headers: getHeaders(authHeader),
      body: JSON.stringify({ approved }),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("[OPENCODE-API]", "info", "Permission yanıtı gönderildi", { permissionId, approved });
    return { success: true };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "respondToPermission hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Session'ı iptal et (mevcut işlemi durdur)
 */
export async function cancelSession(
  port: number,
  authHeader: string | null,
  sessionId: string
): Promise<ApiResponse<void>> {
  if (!sessionId) {
    return { success: false, error: "Session ID gerekli" };
  }

  try {
    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}/cancel`, {
      method: "POST",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("[OPENCODE-API]", "info", "Session iptal edildi", { sessionId });
    return { success: true };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "cancelSession hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Session context'sıkıştır (compact)
 */
export async function compactSession(
  port: number,
  authHeader: string | null,
  sessionId: string
): Promise<ApiResponse<{ tokens?: number }>> {
  if (!sessionId) {
    return { success: false, error: "Session ID gerekli" };
  }

  try {
    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}/compact`, {
      method: "POST",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[OPENCODE-API]", "warn", "Compact endpoint bulunamadı");
        return { success: true, data: { tokens: 0 } };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { tokens?: number; compactedTokens?: number };
    console.log("[OPENCODE-API]", "info", "Session compact edildi", { sessionId, tokens: data.tokens });
    return { success: true, data: { tokens: data.tokens || data.compactedTokens || 0 } };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "compactSession hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Session sil
 */
export async function deleteSession(
  port: number,
  authHeader: string | null,
  sessionId: string
): Promise<ApiResponse<void>> {
  if (!sessionId) {
    return { success: false, error: "Session ID gerekli" };
  }

  try {
    console.log("[OPENCODE-API]", "info", "Session siliniyor", { sessionId });
    
    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}`, {
      method: "DELETE",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[OPENCODE-API]", "warn", "Session bulunamadı", { sessionId });
        return { success: false, error: "Session not found" };
      }
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log("[OPENCODE-API]", "info", "Session silindi", { sessionId });
    return { success: true };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "deleteSession hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Session güncelle (rename/title değiştir)
 */
export async function updateSession(
  port: number,
  authHeader: string | null,
  sessionId: string,
  updates: { title?: string }
): Promise<ApiResponse<void>> {
  if (!sessionId) {
    return { success: false, error: "Session ID gerekli" };
  }

  try {
    console.log("[OPENCODE-API]", "info", "Session güncelleniyor", { sessionId, updates });
    
    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}`, {
      method: "PATCH",
      headers: getHeaders(authHeader),
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[OPENCODE-API]", "warn", "Session bulunamadı", { sessionId });
        return { success: false, error: "Session not found" };
      }
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log("[OPENCODE-API]", "info", "Session güncellendi", { sessionId, updates });
    return { success: true };
  } catch (err) {
    console.log("[OPENCODE-API]", "error", "updateSession hatası", { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}
