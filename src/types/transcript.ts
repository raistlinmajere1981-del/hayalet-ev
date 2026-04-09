export type TranscriptTargetId = "analyze-compose" | "assistant-opencode-native";

export type TranscriptIngressSource = "pc-mic" | "android-bridge" | "synthetic-test";
export type TranscriptIngressMetadata = Record<string, unknown>;

export type TranscriptRuntimeState = "ready" | "preparing" | "missing-runtime" | "error";

export interface TranscriptRuntimeStatus {
  state: TranscriptRuntimeState;
  ready: boolean;
  binaryPath: string | null;
  modelPath: string | null;
  modelId: string;
  modelLanguage: string;
  message: string | null;
}

export interface TranscriptTranscriptionRequest {
  audioBase64: string;
  language?: string | null;
  source?: TranscriptIngressSource | null;
  metadata?: TranscriptIngressMetadata | null;
}

export interface TranscriptTranscriptionResult {
  success: boolean;
  text?: string;
  status: TranscriptRuntimeStatus;
  error?: string;
}

export interface TranscriptIngressPayload {
  requestId: string;
  createdAt: string;
  text: string;
  source: TranscriptIngressSource;
  target: TranscriptTargetId | null;
  isFinal: boolean;
  metadata: TranscriptIngressMetadata | null;
}

export interface TranscriptSubmitIngressRequest {
  text: string;
  source?: Exclude<TranscriptIngressSource, "pc-mic"> | null;
  target?: TranscriptTargetId | null;
  isFinal?: boolean | null;
  metadata?: TranscriptIngressMetadata | null;
}

export interface TranscriptSubmitIngressResult {
  success: boolean;
  payload?: TranscriptIngressPayload;
  error?: string;
}
