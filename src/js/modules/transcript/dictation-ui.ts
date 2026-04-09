import type { TranscriptIngressPayload, TranscriptTargetId } from "../../../types/transcript.js";
import { getTranscriptStatus, transcribeLocalAudio } from "./electron-client.js";
import { startMicrophoneCapture, type MicrophoneCaptureSession } from "./microphone-capture.js";
import { insertTranscriptIntoTextarea } from "./textarea-insertion.js";

type DictationState = "idle" | "listening" | "transcribing";
type DictationNoticeKind = "info" | "success" | "error";

export interface DictationLabels {
  idleTitle: string;
  listeningTitle: string;
  transcribingTitle: string;
  listeningMessage: string;
  preparingMessage: string;
  emptyResultMessage: string;
  insertedMessage: string;
  captureError: (message: string) => string;
  transcriptionError: (message: string) => string;
}

export interface DictationBinding {
  dispose: () => void;
  refresh: () => void;
}

interface BindDictationTriggerOptions {
  button: HTMLButtonElement | null;
  textarea: HTMLTextAreaElement | null;
  targetId: TranscriptTargetId;
  getLabels: () => DictationLabels;
  showNotice: (message: string, kind?: DictationNoticeKind) => void;
  isTargetActive?: () => boolean;
  subscribeIngress?: (callback: (payload: TranscriptIngressPayload) => void) => () => void;
}

const MICROPHONE_ICON = `
  <svg class="dictation-trigger__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M12 15a4 4 0 0 0 4-4V7a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Zm6-4a1 1 0 1 1 2 0 8 8 0 0 1-7 7.94V22h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.06A8 8 0 0 1 4 11a1 1 0 1 1 2 0 6 6 0 1 0 12 0Z"
    />
  </svg>
`;

const STOP_ICON = `
  <svg class="dictation-trigger__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"></rect>
  </svg>
`;

const SPINNER_ICON = `
  <svg class="dictation-trigger__icon dictation-trigger__icon--spinner" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32 14"></circle>
  </svg>
`;

function setButtonState(
  button: HTMLButtonElement,
  state: DictationState,
  labels: DictationLabels
): void {
  button.dataset["dictationState"] = state;
  button.classList.toggle("is-listening", state === "listening");
  button.classList.toggle("is-transcribing", state === "transcribing");
  button.disabled = state === "transcribing";
  button.setAttribute("aria-pressed", state === "listening" ? "true" : "false");

  switch (state) {
    case "idle":
      button.title = labels.idleTitle;
      button.setAttribute("aria-label", labels.idleTitle);
      button.innerHTML = MICROPHONE_ICON;
      return;
    case "listening":
      button.title = labels.listeningTitle;
      button.setAttribute("aria-label", labels.listeningTitle);
      button.innerHTML = STOP_ICON;
      return;
    case "transcribing":
      button.title = labels.transcribingTitle;
      button.setAttribute("aria-label", labels.transcribingTitle);
      button.innerHTML = SPINNER_ICON;
      return;
  }
}

export function bindDictationTrigger(options: BindDictationTriggerOptions): DictationBinding {
  const { button, textarea } = options;

  if (button == null || textarea == null) {
    return {
      dispose: (): void => {},
      refresh: (): void => {},
    };
  }

  let captureSession: MicrophoneCaptureSession | null = null;
  let currentState: DictationState = "idle";

  const refresh = (): void => {
    setButtonState(button, currentState, options.getLabels());
  };

  const insertTranscript = (text: string, showInsertedNotice: boolean): void => {
    insertTranscriptIntoTextarea(textarea, text);
    if (showInsertedNotice) {
      options.showNotice(options.getLabels().insertedMessage, "success");
    }
  };

  const dispatchTranscript = (payload: TranscriptIngressPayload): void => {
    handleIngress(payload);
  };

  const handleIngress = (payload: TranscriptIngressPayload): void => {
    if (options.isTargetActive?.() === false) {
      return;
    }
    if (payload.target !== null && payload.target !== options.targetId) {
      return;
    }
    if (payload.text.trim() === "") {
      return;
    }
    insertTranscript(payload.text, true);
  };

  const stopCaptureAndTranscribe = async (): Promise<void> => {
    const labels = options.getLabels();
    const activeCapture = captureSession;
    captureSession = null;
    currentState = "transcribing";
    refresh();

    try {
      if (activeCapture == null) {
        throw new Error("Microphone capture session is not active.");
      }

      const capture = await activeCapture.stop();
      const transcription = await transcribeLocalAudio({
        audioBase64: capture.audioBase64,
        language: "auto",
        source: "pc-mic",
      });

      if (transcription.success !== true || transcription.text == null) {
        throw new Error(transcription.error ?? labels.emptyResultMessage);
      }

      dispatchTranscript({
        requestId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        text: transcription.text,
        source: "pc-mic",
        target: options.targetId,
        isFinal: true,
        metadata: {
          durationMs: capture.durationMs,
          sourceSampleRate: capture.sourceSampleRate,
          targetSampleRate: capture.targetSampleRate,
          frameCount: capture.frameCount,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.showNotice(labels.transcriptionError(message), "error");
    } finally {
      currentState = "idle";
      refresh();
    }
  };

  const handleClick = (): void => {
    if (currentState === "transcribing") {
      return;
    }

    if (currentState === "listening") {
      void stopCaptureAndTranscribe();
      return;
    }

    void (async (): Promise<void> => {
      const labels = options.getLabels();

      try {
        const status = await getTranscriptStatus();
        if (status.ready !== true) {
          options.showNotice(labels.preparingMessage, "info");
        }

        captureSession = await startMicrophoneCapture();
        currentState = "listening";
        refresh();
        options.showNotice(labels.listeningMessage, "info");
      } catch (error) {
        captureSession = null;
        currentState = "idle";
        refresh();
        const message = error instanceof Error ? error.message : String(error);
        options.showNotice(labels.captureError(message), "error");
      }
    })();
  };

  button.addEventListener("click", handleClick);
  const unsubscribeIngress: () => void =
    options.subscribeIngress?.(handleIngress) ?? ((): void => {});
  refresh();

  return {
    dispose: (): void => {
      button.removeEventListener("click", handleClick);
      unsubscribeIngress();
      if (captureSession !== null) {
        void captureSession.abort();
        captureSession = null;
      }
      currentState = "idle";
    },
    refresh,
  };
}
