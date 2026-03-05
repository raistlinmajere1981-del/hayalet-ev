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
      throw new Error(result.error ?? `HTTP ${String(result.status ?? "unknown")}`);
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
