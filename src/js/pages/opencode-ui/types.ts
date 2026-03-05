export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiProxyResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  status?: number;
}

export interface FetchOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface CustomSelectItem {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeClass?: string;
}

export interface CustomSelectAPI {
  setItems: (items: CustomSelectItem[], activeValue?: string) => void;
  setError: (msg?: string) => void;
}

export type CustomSelectCallback = (value: string, text: string) => void | Promise<void>;
