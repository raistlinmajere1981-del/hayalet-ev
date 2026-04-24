function sourceSupportsClipSuggestion(sourceKind) {
  return sourceKind === "audio" || sourceKind === "video";
}
function sourceSupportsAudioSuggestion(sourceKind) {
  return sourceKind === "audio" || sourceKind === "video";
}
function sourceSupportsVisualSuggestion(sourceKind) {
  return sourceKind === "image" || sourceKind === "video";
}
function sourceSupportsFocusSuggestion(sourceKind) {
  return sourceKind === "image" || sourceKind === "video";
}
export function getSelectionSuggestionsForContext(activeSelection, sourceKind) {
  if (activeSelection === null || activeSelection.endMs <= activeSelection.startMs) {
    return [];
  }
  const suggestions = [];
  function pushSuggestion(suggestion) {
    if (suggestions.some((entry) => entry.id === suggestion.id)) {
      return;
    }
    suggestions.push(suggestion);
  }
  switch (activeSelection.intent) {
    case "anomaly":
      if (sourceKind === "audio" || sourceKind === "video" || sourceKind === "image") {
        pushSuggestion({
          id: "analyze-anomaly",
          label: "Anomaliyi analiz et",
          actionType: "analyze-segment",
          confidence: 0.9
        });
      }
      break;
    case "motion":
      if (sourceKind === "video") {
        pushSuggestion({
          id: "motion-check",
          label: "Hareket tutarliligini incele",
          actionType: "analyze-segment",
          confidence: 0.85
        });
      }
      break;
    case "audio":
      if (sourceSupportsAudioSuggestion(sourceKind)) {
        pushSuggestion({
          id: "audio-inspect",
          label: "Ses detaylarini incele",
          actionType: "inspect-audio",
          confidence: 0.9
        });
      }
      break;
    case "visual":
      if (sourceSupportsVisualSuggestion(sourceKind)) {
        pushSuggestion({
          id: "enhance-visual",
          label: "Goruntuyu iyilestir",
          actionType: "enhance-visual",
          confidence: 0.8
        });
      }
      break;
    default:
      break;
  }
  if (sourceSupportsClipSuggestion(sourceKind)) {
    pushSuggestion({
      id: "extract-clip",
      label: "Bu bolumu kes",
      actionType: "extract-clip",
      confidence: suggestions.length > 0 ? 0.6 : 0.68
    });
  } else if (sourceSupportsFocusSuggestion(sourceKind)) {
    pushSuggestion({
      id: "focus-region",
      label: "Bolgeye odaklan",
      actionType: "focus-region",
      confidence: suggestions.length > 0 ? 0.58 : 0.66
    });
  }
  return suggestions;
}
export function buildSelectionSuggestionPreview(suggestion, selection) {
  const durationMs = Math.max(0, selection.endMs - selection.startMs);
  const durationLabel = durationMs <= 0 ? "Secilen zaman araligi" : durationMs < 1e3 ? `${durationMs}ms secim` : `${(durationMs / 1e3).toFixed(1)}s secim`;
  const preparationStep = `${durationLabel} hazirlanacak`;
  switch (suggestion.actionType) {
    case "analyze-segment":
      return {
        suggestionId: suggestion.id,
        title: "Segment analiz edilecek",
        steps: [
          preparationStep,
          "Gorsel ve/veya ses sinyalleri ayristirilacak",
          "Anomali veya tutarsizlik incelemesi hazirlanacak"
        ],
        expectedOutputs: [
          "Analiz raporu",
          "Tespit edilen bulgular",
          "Ilgili frame veya segment referanslari"
        ],
        estimatedCost: "medium"
      };
    case "inspect-audio":
      return {
        suggestionId: suggestion.id,
        title: "Ses analizi yapilacak",
        steps: [
          preparationStep,
          "Ses track izole edilecek",
          "Frekans ve yogunluk taramasi hazirlanacak",
          "Ani degisim noktalarina bakilacak"
        ],
        expectedOutputs: ["Ses analizi raporu", "Olasi anomali noktalari"],
        estimatedCost: "low"
      };
    case "extract-clip":
      return {
        suggestionId: suggestion.id,
        title: "Clip olusturulacak",
        steps: [preparationStep, "Secilen segment yeni bir clip olarak hazirlanacak"],
        expectedOutputs: ["Video veya audio clip"],
        estimatedCost: "low"
      };
    default:
      return {
        suggestionId: suggestion.id,
        title: "Islem hazirlaniyor",
        steps: ["Bu islem icin detayli plan henuz tanimli degil"],
        expectedOutputs: [],
        estimatedCost: "low"
      };
  }
}
