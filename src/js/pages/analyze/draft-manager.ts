/**
 * DraftManager - Analyze sayfası draft yönetimi
 * 
 * Bu modül compose alanındaki taslak mesajı yönetir:
 * - Draft kaydetme (beforeunload)
 * - Draft yükleme
 * - Base64 decode
 */

import { LogManager } from "../../modules/log-manager.js";
import { FileManager } from "../../modules/file-manager.js";

let draftPath = "";

/**
 * Base64 encoded string'i decode et
 * @param {string} data - Base64 encoded string
 * @returns {string}
 */
function decodeBase64(data: string): string {
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  } catch (_err) {
    return "";
  }
}

/**
 * Draft sistemini başlat
 * @returns {Promise<void>}
 */
export async function initDraft() {
  try {
    // Draft dosyası data klasöründe tutulacak
    draftPath = "data/analyze-draft.json";
  } catch (err) {
    LogManager.addEvent("analyze", "warning", `Draft yolu hazırlanamadı: ${err.message}`);
  }
}

/**
 * Draft'ı yükle
 * @returns {Promise<{message: string, files: Array}>}
 */
export async function loadDraft() {
  if (!draftPath || !window.electronAPI?.readFile) {
    return { message: "", files: [] };
  }
  
  try {
    const base64 = await window.electronAPI.readFile(draftPath);
    
    if (!base64) {
      return { message: "", files: [] };
    }
    
    const text = decodeBase64(base64);
    const parsed = JSON.parse(text || "{}");
    
    return {
      message: parsed.message || "",
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch (err) {
    LogManager.addEvent("analyze", "warning", `Draft okunamadı: ${err.message}`);
    return { message: "", files: [] };
  }
}

/**
 * Draft'ı kaydet
 * @param {string} message - Compose input değeri
 * @param {Array} files - Staged files
 * @returns {Promise<void>}
 */
export async function persistDraft(message: string, files: unknown[]) {
  if (!draftPath) return;
  
  try {
    const payload = { message: message || "", files: files || [] };
    const json = JSON.stringify(payload, null, 2);
    await FileManager.writeFileAtomic(draftPath, json, "utf-8");
  } catch (err) {
    LogManager.addEvent("analyze", "warning", `Draft yazılamadı: ${err.message}`);
  }
}

