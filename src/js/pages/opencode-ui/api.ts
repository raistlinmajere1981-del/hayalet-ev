import type { ApiProxyResult, FetchOptions, HttpMethod } from "./types.js";

let opencodeUiBaseUrl = "http://127.0.0.1:4096";

export function setApiBaseUrl(baseUrl: string): void {
  const trimmed = baseUrl.trim();
  if (trimmed !== "") {
    opencodeUiBaseUrl = trimmed;
  }
}

export function getApiBaseUrl(): string {
  return opencodeUiBaseUrl;
}

export function extractApiTextPayload(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return "";
  }

  const record = data as Record<string, unknown>;
  const raw = record["_raw"];
  return typeof raw === "string" ? raw : "";
}

export function isHtmlDocumentPayload(data: unknown): boolean {
  const text = extractApiTextPayload(data).trim().toLowerCase();
  if (text === "") {
    return false;
  }

  return (
    text.startsWith("<!doctype html") ||
    text.startsWith("<html") ||
    (text.includes("<html") && text.includes("</html>"))
  );
}

function extractProxyErrorMessage(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return "";
  }

  const record = data as Record<string, unknown>;
  const directMessage = record["message"];
  if (typeof directMessage === "string" && directMessage !== "") {
    return directMessage;
  }

  const errorField = record["error"];
  if (Array.isArray(errorField) && errorField.length > 0) {
    const first: unknown = errorField[0];
    if (first != null && typeof first === "object") {
      const message = (first as Record<string, unknown>)["message"];
      if (typeof message === "string" && message !== "") {
        return message;
      }
    }
  }

  return "";
}

export async function apiCall<T = Record<string, unknown>>(
  method: HttpMethod,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = opencodeUiBaseUrl + path;

  if (window.electronAPI && typeof window.electronAPI["opencodeUiApiProxy"] === "function") {
    const proxyPayload: { url: string; method: HttpMethod; body?: string } = { url, method };
    if (body !== undefined) {
      proxyPayload.body = JSON.stringify(body);
    }

    const result = (await window.electronAPI["opencodeUiApiProxy"](proxyPayload)) as ApiProxyResult;

    if (!result.success) {
      const proxyDetail = result.error ?? extractProxyErrorMessage(result.data);
      const detail =
        proxyDetail !== "" ? proxyDetail : `HTTP ${String(result.status ?? "unknown")}`;
      throw new Error(detail);
    }

    return (result.data ?? {}) as T;
  }

  const options: FetchOptions = { method };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)} ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch (_error) {
    return { _raw: text } as T;
  }
}
