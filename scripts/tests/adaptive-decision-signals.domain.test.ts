import {
  __testOnlyBuildExecutionPatternKey,
  __testOnlyResetExecutionPatternRegistry,
  assert,
  buildAdaptiveDecisionSignal,
  buildCounterfactualProjection,
  buildDecisionPosture,
  buildDecisionCoherence,
  __testOnlyResolveLabI18nFromDictionaries,
  buildExecutionAlternatives,
  buildExecutionAlternativesFromResolved,
  buildExecutionBridge,
  buildExecutionCandidateFromResolved,
  buildExecutionDescriptor,
  buildExecutionReadinessSignal,
  buildGuidedAlternativeSignal,
  buildExecutionPayloadPreview,
  buildExecutionPayloadPreviewFromResolved,
  buildExecutionPlan,
  buildExecutionReadiness,
  buildExecutionReflection,
  buildExecutionReflectionFromResolved,
  buildExecutionResultInterpretation,
  buildExecutionSimulation,
  buildExecutionStagingFromResolved,
  createLabExecutionDispatcher,
  createMockExecutionResult,
  createLabStore,
  createTestAudioFocusSettings,
  getActiveExecutionAlternatives,
  getActiveExecutionCandidate,
  getActiveExecutionCommitment,
  getActiveExecutionGoalEvaluation,
  getActiveExecutionIntent,
  getActiveExecutionResult,
  getActiveExecutionPayloadPreview,
  getActiveExecutionPlan,
  getActiveExecutionReadiness,
  getActiveExecutionReflection,
  getActiveExecutionSimulation,
  getActiveExecutionStaging,
  getActiveExecutionResultInterpretation,
  getActiveSuggestionPreviewId,
  getExecutionDispatchCandidate,
  getExecutionGoalEvaluation,
  getLaboratoryProcessSummary,
  getLaboratoryRightPanelContext,
  formatExecutionBridgeAdvisory,
  formatDecisionCoherenceAdvisory,
  formatDecisionPostureLabel,
  formatExecutionDescriptorAdvisory,
  formatExecutionReadinessSignalAdvisory,
  installTimerMock,
  prependDecisionPostureLabel,
  reorderDecisionSummary,
  resolveLabI18n,
  test,
} from "./laboratory-runtime-truth.helpers.ts";

import type {
  LabActionSuggestion,
  LabAudioFocusSettings,
  LabExecutionCommitment,
  LabExecutionDispatchCandidate,
  LabExecutionPayloadPreview,
  LabExecutionResult,
  LabSelection,
} from "./laboratory-runtime-truth.helpers.ts";

describe("adaptive decision signals", () => {
  void test("adaptive decision signal maps goal pattern and alignment deterministically", () => {
    const weakFailed = buildAdaptiveDecisionSignal({
      executionGoalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.2,
        summary: "Goal failed",
        patternSignal: {
          averageCoverage: 0.42,
          executionCount: 2,
          failureRatio: 1,
          strength: "weak",
          successRatio: 0,
        },
      },
      executionResultInterpretation: {
        alignment: "matches-simulation",
      },
    });
    assert.deepEqual(weakFailed, {
      adaptiveDecisionHint: "This path has historically underperformed under similar conditions.",
      decisionPressure: "high",
    });

    const failedAndDeviates = buildAdaptiveDecisionSignal({
      executionGoalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.25,
        summary: "Goal failed",
      },
      executionResultInterpretation: {
        alignment: "deviates",
      },
    });
    assert.deepEqual(failedAndDeviates, {
      adaptiveDecisionHint: "Current execution feedback indicates this path needs careful review.",
      decisionPressure: "high",
    });

    const weakPartial = buildAdaptiveDecisionSignal({
      executionGoalEvaluation: {
        outcome: "neutral",
        goalAlignment: 0.5,
        summary: "Goal inconclusive",
        patternSignal: {
          averageCoverage: 0.48,
          executionCount: 2,
          failureRatio: 0.5,
          strength: "weak",
          successRatio: 0.5,
        },
      },
      executionResultInterpretation: {
        alignment: "partial",
      },
    });
    assert.deepEqual(weakPartial, {
      adaptiveDecisionHint: "Alternative strategies may yield more stable results.",
      decisionPressure: "medium",
    });

    const strongSuccess = buildAdaptiveDecisionSignal({
      executionGoalEvaluation: {
        outcome: "successful",
        goalAlignment: 0.9,
        summary: "Goal achieved",
        patternSignal: {
          averageCoverage: 0.88,
          executionCount: 3,
          failureRatio: 0,
          strength: "strong",
          successRatio: 1,
        },
      },
      executionResultInterpretation: {
        alignment: "matches-simulation",
      },
    });
    assert.deepEqual(strongSuccess, {
      adaptiveDecisionHint: "",
      decisionPressure: "low",
    });

    assert.deepEqual(
      buildAdaptiveDecisionSignal({
        executionGoalEvaluation: {
          outcome: "successful",
          goalAlignment: 0.85,
          summary: "Goal achieved with weak history",
          patternSignal: {
            averageCoverage: 0.44,
            executionCount: 2,
            failureRatio: 0.5,
            strength: "weak",
            successRatio: 0.5,
          },
        },
        executionResultInterpretation: {
          alignment: "matches-simulation",
        },
      }),
      {
        adaptiveDecisionHint: "Alternative strategies may yield more stable results.",
        decisionPressure: "medium",
      }
    );
    assert.deepEqual(buildAdaptiveDecisionSignal({}), {
      adaptiveDecisionHint: "",
      decisionPressure: "low",
    });
  });

  void test("decision posture compresses adaptive feedback into deterministic labels", () => {
    assert.deepEqual(
      buildDecisionPosture({
        decisionPressure: "low",
        executionGoalEvaluation: {
          outcome: "successful",
          goalAlignment: 0.9,
          summary: "Goal achieved",
          patternSignal: {
            averageCoverage: 0.88,
            executionCount: 3,
            failureRatio: 0,
            strength: "strong",
            successRatio: 1,
          },
        },
        executionResultInterpretation: {
          alignment: "matches-simulation",
        },
      }),
      {
        posture: "proceed",
        shortLabel: "Proceed",
      }
    );
    assert.deepEqual(
      buildDecisionPosture({
        decisionPressure: "high",
        executionGoalEvaluation: {
          outcome: "failed",
          goalAlignment: 0.2,
          summary: "Goal failed",
          patternSignal: {
            averageCoverage: 0.38,
            executionCount: 2,
            failureRatio: 1,
            strength: "weak",
            successRatio: 0,
          },
        },
        executionResultInterpretation: {
          alignment: "deviates",
        },
      }),
      {
        posture: "reconsider",
        shortLabel: "Reconsider",
      }
    );
    assert.deepEqual(
      buildDecisionPosture({
        decisionPressure: "low",
      }),
      {
        posture: "proceed-with-caution",
        shortLabel: "Proceed with caution",
      }
    );
    assert.deepEqual(
      buildDecisionPosture({
        decisionPressure: "medium",
        executionGoalEvaluation: {
          outcome: "successful",
          goalAlignment: 0.8,
          summary: "Goal achieved with divergence",
          patternSignal: {
            averageCoverage: 0.72,
            executionCount: 2,
            failureRatio: 0.5,
            strength: "neutral",
            successRatio: 0.5,
          },
        },
        executionResultInterpretation: {
          alignment: "deviates",
        },
      }),
      {
        posture: "proceed-with-caution",
        shortLabel: "Proceed with caution",
      }
    );
  });

  void test("decision posture prefix formatter stays idempotent across rerenders", () => {
    const caution = buildDecisionPosture({
      decisionPressure: "low",
    });
    const proceed = buildDecisionPosture({
      decisionPressure: "low",
      executionGoalEvaluation: {
        outcome: "successful",
        goalAlignment: 0.9,
        summary: "Goal achieved",
        patternSignal: {
          averageCoverage: 0.88,
          executionCount: 3,
          failureRatio: 0,
          strength: "strong",
          successRatio: 1,
        },
      },
      executionResultInterpretation: {
        alignment: "matches-simulation",
      },
    });

    assert.equal(
      prependDecisionPostureLabel("This path is structurally ready for execution.", caution),
      "Proceed with caution: This path is structurally ready for execution."
    );
    assert.equal(
      prependDecisionPostureLabel(
        "Proceed with caution: This path is structurally ready for execution.",
        caution
      ),
      "Proceed with caution: This path is structurally ready for execution."
    );
    assert.equal(
      prependDecisionPostureLabel(
        "Reconsider: This path is structurally ready for execution.",
        proceed
      ),
      "Proceed: This path is structurally ready for execution."
    );
  });

  void test("guided alternative signal ranks advisory alternatives deterministically", () => {
    const alternatives = [
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        relativeAdvantage: "higher-coverage" as const,
        summary: "Review broader context.",
        tradeoff: "Trades precision for coverage.",
      },
      {
        actionType: "stabilize-segment",
        label: "Stability-first comparison",
        relativeAdvantage: "more-stable" as const,
        summary: "Compare steadier evidence first.",
        tradeoff: "Trades immediacy for stability.",
      },
      {
        actionType: "focus-region",
        label: "Region-focused inspection",
        relativeAdvantage: "higher-precision" as const,
        summary: "Review the selected region.",
        tradeoff: "Trades coverage for precision.",
      },
    ];
    const highGuidance = buildGuidedAlternativeSignal({
      alternatives,
      alternativesConfidence: 0.72,
      decisionPressure: "high",
      executionGoalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.2,
        summary: "Goal failed",
        patternSignal: {
          averageCoverage: 0.42,
          executionCount: 2,
          failureRatio: 1,
          strength: "weak",
          successRatio: 0,
        },
      },
      executionResultInterpretation: {
        alignment: "deviates",
      },
    });
    assert.deepEqual(highGuidance, {
      candidateGuidanceText: "Consider comparing Stability-first comparison for steadier context.",
      guidanceText:
        "A more stable alternative under current conditions is: Stability-first comparison.",
      preferredAlternativeIndex: 1,
      preferredAlternativeLabel: "Stability-first comparison",
    });

    const mediumGuidance = buildGuidedAlternativeSignal({
      alternatives,
      alternativesConfidence: 0.72,
      decisionPressure: "medium",
      executionGoalEvaluation: {
        outcome: "neutral",
        goalAlignment: 0.5,
        summary: "Goal inconclusive",
      },
      executionResultInterpretation: {
        alignment: "partial",
      },
    });
    assert.equal(mediumGuidance.preferredAlternativeLabel, "Stability-first comparison");
    assert.match(mediumGuidance.guidanceText, /A softer alternative to compare next is/);

    assert.deepEqual(
      buildGuidedAlternativeSignal({
        alternatives,
        decisionPressure: "low",
      }),
      {
        candidateGuidanceText: "",
        guidanceText: "",
        preferredAlternativeIndex: null,
        preferredAlternativeLabel: null,
      }
    );
    assert.deepEqual(
      buildGuidedAlternativeSignal({
        alternatives: [],
        decisionPressure: "high",
      }),
      {
        candidateGuidanceText: "",
        guidanceText: "",
        preferredAlternativeIndex: null,
        preferredAlternativeLabel: null,
      }
    );
    assert.equal(
      buildGuidedAlternativeSignal({
        alternatives: [
          {
            actionType: "a",
            label: "First equal path",
            relativeAdvantage: "higher-coverage",
            summary: "First.",
            tradeoff: "Equal.",
          },
          {
            actionType: "b",
            label: "Second equal path",
            relativeAdvantage: "higher-coverage",
            summary: "Second.",
            tradeoff: "Equal.",
          },
        ],
        decisionPressure: "high",
      }).preferredAlternativeIndex,
      0
    );
    assert.doesNotMatch(
      `${highGuidance.guidanceText} ${highGuidance.candidateGuidanceText}`,
      /\b(auto|commit|dispatch|execute|run|apply|switch|select|activate|choose)\b/i
    );
  });

  void test("counterfactual projection remains deterministic and pressure-aware", () => {
    const selectionSnapshot = {
      endMs: 4400,
      inspectionMode: "visual" as const,
      sourceKind: "video",
      startMs: 1200,
      type: "inspect" as const,
    };
    const stableProjection = buildCounterfactualProjection(
      {
        actionType: "inspect-motion",
        label: "Motion continuity inspection",
        relativeAdvantage: "more-stable",
        summary: "Compare motion continuity.",
        tradeoff: "Trades still detail for steadier motion evidence.",
      },
      {
        decisionPressure: "high",
        executionGoalEvaluation: {
          outcome: "failed",
          goalAlignment: 0.2,
          summary: "Goal failed",
          patternSignal: {
            averageCoverage: 0.38,
            executionCount: 3,
            failureRatio: 1,
            strength: "weak",
            successRatio: 0,
          },
        },
        executionResult: {
          summary: "Focused region remained unstable",
          insights: ["Coverage remained narrow"],
          artifacts: [],
          metrics: {
            confidence: 0.44,
            coverage: 0.32,
          },
          selectionSnapshot,
        },
        executionResultInterpretation: {
          alignment: "deviates",
        },
      }
    );
    assert.deepEqual(stableProjection, {
      expectedCoverage: "increase",
      expectedAlignment: "better",
      expectedStability: "higher",
      summary:
        "Projected outcome suggests higher stability, better alignment, and increase coverage.",
    });
    assert.deepEqual(
      buildCounterfactualProjection(
        {
          actionType: "inspect-motion",
          label: "Motion continuity inspection",
          relativeAdvantage: "more-stable",
          summary: "Compare motion continuity.",
          tradeoff: "Trades still detail for steadier motion evidence.",
        },
        {
          decisionPressure: "high",
          executionGoalEvaluation: {
            outcome: "failed",
            goalAlignment: 0.2,
            summary: "Goal failed",
            patternSignal: {
              averageCoverage: 0.38,
              executionCount: 3,
              failureRatio: 1,
              strength: "weak",
              successRatio: 0,
            },
          },
          executionResult: {
            summary: "Focused region remained unstable",
            insights: ["Coverage remained narrow"],
            artifacts: [],
            metrics: {
              confidence: 0.44,
              coverage: 0.32,
            },
            selectionSnapshot,
          },
          executionResultInterpretation: {
            alignment: "deviates",
          },
        }
      ),
      stableProjection
    );
    assert.deepEqual(
      buildCounterfactualProjection(
        {
          actionType: "inspect-motion",
          label: "Motion continuity inspection",
          relativeAdvantage: "more-stable",
          summary: "Compare motion continuity.",
          tradeoff: "Trades still detail for steadier motion evidence.",
        },
        {}
      ),
      {
        expectedCoverage: "stable",
        expectedAlignment: "similar",
        expectedStability: "similar",
        summary: "",
      }
    );
    assert.deepEqual(
      buildCounterfactualProjection(
        {
          actionType: "analyze-segment",
          label: "Broader segment review",
          relativeAdvantage: "higher-coverage",
          summary: "Compare broader context.",
          tradeoff: "Trades precision for context.",
        },
        {
          executionResult: {
            summary: "Selected audio remained mixed",
            insights: [],
            artifacts: [],
            metrics: {
              coverage: 0.88,
            },
            selectionSnapshot: {
              endMs: 3000,
              inspectionMode: "audio",
              sourceKind: "audio",
              startMs: 1000,
              type: "clip",
            },
          },
          executionResultInterpretation: {
            alignment: "matches-simulation",
          },
        }
      ),
      {
        expectedCoverage: "stable",
        expectedAlignment: "similar",
        expectedStability: "similar",
        summary: "",
      }
    );
  });
});
