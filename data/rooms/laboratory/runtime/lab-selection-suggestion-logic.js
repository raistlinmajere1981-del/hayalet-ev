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
export function getSelectionSuggestionsForContext(activeSelection, context) {
  if (activeSelection === null || activeSelection.endMs <= activeSelection.startMs) {
    return [];
  }
  const sourceKind = context.sourceKind;
  const inspectionMode = context.inspectionMode ?? "none";
  const hasSelectionRoi = activeSelection.roi !== void 0;
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
          confidence: hasSelectionRoi ? 0.94 : 0.9
        });
      }
      break;
    case "motion":
      if (sourceKind === "video") {
        pushSuggestion({
          id: "motion-check",
          label: "Hareket tutarliligini incele",
          ...hasSelectionRoi ? { toolHint: "Inspect motion" } : {},
          actionType: "analyze-segment",
          confidence: hasSelectionRoi || inspectionMode === "motion" ? 0.92 : 0.85
        });
      }
      break;
    case "audio":
      if (sourceSupportsAudioSuggestion(sourceKind)) {
        pushSuggestion({
          id: "audio-inspect",
          label: "Ses detaylarini incele",
          actionType: "inspect-audio",
          confidence: inspectionMode === "audio" ? 0.93 : 0.9
        });
      }
      break;
    case "visual":
      if (sourceSupportsVisualSuggestion(sourceKind)) {
        pushSuggestion({
          id: "enhance-visual",
          label: "Goruntuyu iyilestir",
          ...hasSelectionRoi ? { toolHint: "Enhance clarity" } : {},
          actionType: "enhance-visual",
          confidence: hasSelectionRoi || inspectionMode === "visual" ? 0.86 : 0.8
        });
      }
      break;
    default:
      break;
  }
  if (hasSelectionRoi && sourceSupportsFocusSuggestion(sourceKind)) {
    pushSuggestion({
      id: "inspect-region",
      label: "Secili bolgeyi incele",
      toolHint: "Focus region",
      actionType: "focus-region",
      confidence: inspectionMode === "motion" || inspectionMode === "visual" ? 0.88 : 0.82
    });
  }
  if (hasSelectionRoi && sourceKind === "video") {
    if (suggestions.some(function(entry) {
      return entry.toolHint === "Inspect motion";
    }) !== true) {
      pushSuggestion({
        id: "inspect-motion-region",
        label: "Bolgedeki hareketi incele",
        toolHint: "Inspect motion",
        actionType: "inspect-motion",
        confidence: inspectionMode === "motion" ? 0.9 : 0.84
      });
    }
    pushSuggestion({
      id: "stabilize-region",
      label: "Segmenti stabilize et",
      toolHint: "Stabilize segment",
      actionType: "stabilize-segment",
      confidence: 0.72
    });
  }
  if (hasSelectionRoi && sourceSupportsVisualSuggestion(sourceKind)) {
    if (suggestions.some(function(entry) {
      return entry.toolHint === "Enhance clarity";
    }) !== true) {
      pushSuggestion({
        id: "enhance-region-clarity",
        label: "Bolge netligini artir",
        toolHint: "Enhance clarity",
        actionType: "enhance-visual",
        confidence: inspectionMode === "visual" ? 0.83 : 0.76
      });
    }
  }
  if (sourceSupportsClipSuggestion(sourceKind)) {
    pushSuggestion({
      id: "extract-clip",
      label: "Bu bolumu kes",
      actionType: "extract-clip",
      confidence: suggestions.length > 0 ? 0.6 : 0.68
    });
  } else if (sourceSupportsFocusSuggestion(sourceKind) && hasSelectionRoi !== true) {
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
    case "focus-region":
      return {
        suggestionId: suggestion.id,
        title: "Bolge incelemesi hazirlanacak",
        steps: [
          preparationStep,
          "Secili goruntu bolgesi izole edilecek",
          "Bolgeye odakli gorsel inceleme hazirlanacak"
        ],
        expectedOutputs: ["Bolge odakli notlar", "Ilgili goruntu referanslari"],
        estimatedCost: "low"
      };
    case "inspect-motion":
      return {
        suggestionId: suggestion.id,
        title: "Bolgedeki hareket incelemesi hazirlanacak",
        steps: [
          preparationStep,
          "Secili goruntu bolgesi hareket odakli izole edilecek",
          "Frame seviyesinde hareket belirsizligi ve akis okunabilirligi gozden gecirilecek"
        ],
        expectedOutputs: ["Hareket odakli notlar", "Frame referanslari"],
        estimatedCost: "low"
      };
    default:
      if (suggestion.actionType === "stabilize-segment") {
        return {
          suggestionId: suggestion.id,
          title: "Stabilizasyon onizlemesi hazirlanacak",
          steps: [
            preparationStep,
            "Secilen bolge ve segment sabitlenmis bir inceleme gorunumu icin hazirlanacak",
            "Goruntu akisi karsilastirmali olarak gozden gecirilecek"
          ],
          expectedOutputs: ["Stabilizasyon notlari", "Karsilastirmali goruntu referanslari"],
          estimatedCost: "low"
        };
      }
      return {
        suggestionId: suggestion.id,
        title: "Islem hazirlaniyor",
        steps: ["Bu islem icin detayli plan henuz tanimli degil"],
        expectedOutputs: [],
        estimatedCost: "low"
      };
  }
}
