import { resolveSelectorLanguage } from "../i18n/locale.js";
import type {
  TranscriptManagedModelDescriptor,
  TranscriptManagedModelId,
  TranscriptModelVariant,
  TranscriptSupportedLanguage,
} from "../../src/types/transcript.js";

const TRANSCRIPT_MODEL_CATALOG: Record<TranscriptManagedModelId, TranscriptManagedModelDescriptor> =
  {
    tiny: {
      modelId: "tiny",
      variant: "light",
      label: "Tiny Multilingual",
      family: "multilingual",
      locale: "tr",
      englishOnly: false,
      fileName: "ggml-tiny.bin",
      downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
      expectedSha1: "bd577a113a864445d4c299885e0cb97d4ba92b5f",
      expectedBytes: null,
    },
    base: {
      modelId: "base",
      variant: "full",
      label: "Base Multilingual",
      family: "multilingual",
      locale: "tr",
      englishOnly: false,
      fileName: "ggml-base.bin",
      downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
      expectedSha1: "465707469ff3a37a2b9b8d8f89f2f99de7299dac",
      expectedBytes: null,
    },
    "tiny.en": {
      modelId: "tiny.en",
      variant: "light",
      label: "Tiny English",
      family: "english",
      locale: "en",
      englishOnly: true,
      fileName: "ggml-tiny.en.bin",
      downloadUrl:
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
      expectedSha1: "c78c86eb1a8faa21b369bcd33207cc90d64ae9df",
      expectedBytes: 77704715,
    },
    "base.en": {
      modelId: "base.en",
      variant: "full",
      label: "Base English",
      family: "english",
      locale: "en",
      englishOnly: true,
      fileName: "ggml-base.en.bin",
      downloadUrl:
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
      expectedSha1: "137c40403d78fd54d454da0f9bd998f78703390c",
      expectedBytes: 147964211,
    },
  };

const TRANSCRIPT_MODEL_IDS = Object.keys(
  TRANSCRIPT_MODEL_CATALOG
) as TranscriptManagedModelId[];

export function normalizeTranscriptManagedModelId(value: unknown): TranscriptManagedModelId | null {
  return typeof value === "string" && TRANSCRIPT_MODEL_IDS.includes(value as TranscriptManagedModelId)
    ? (value as TranscriptManagedModelId)
    : null;
}

export function normalizeTranscriptModelVariant(
  value: unknown,
  fallback: TranscriptModelVariant = "full"
): TranscriptModelVariant {
  return value === "light" || value === "full" ? value : fallback;
}

export function resolveTranscriptSupportedLanguage(value: unknown): TranscriptSupportedLanguage {
  return resolveSelectorLanguage(value) === "tr" ? "tr" : "en";
}

export function resolveTranscriptModelId(
  language: TranscriptSupportedLanguage,
  variant: TranscriptModelVariant
): TranscriptManagedModelId {
  if (language === "tr") {
    return variant === "light" ? "tiny" : "base";
  }

  return variant === "light" ? "tiny.en" : "base.en";
}

export function getTranscriptModelDescriptor(
  modelId: unknown
): TranscriptManagedModelDescriptor | null {
  const normalizedModelId = normalizeTranscriptManagedModelId(modelId);
  if (normalizedModelId === null) {
    return null;
  }

  return { ...TRANSCRIPT_MODEL_CATALOG[normalizedModelId] };
}

export function listTranscriptModelCatalog(): TranscriptManagedModelDescriptor[] {
  return TRANSCRIPT_MODEL_IDS.map(function (modelId) {
    return { ...TRANSCRIPT_MODEL_CATALOG[modelId] };
  });
}
