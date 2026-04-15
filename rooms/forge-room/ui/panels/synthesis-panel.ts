import type { ForgeUiState, ForgeWorkbenchUiFlowState } from "../../shared/ui/state.js";
import { createForgePanel } from "./panel-shell.js";

function createButton(
  documentRef: Document,
  label: string,
  options: {
    action?: string;
    dataset?: Record<string, string>;
    disabled?: boolean;
    primary?: boolean;
  } = {}
): HTMLButtonElement {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = options.primary
    ? "forge-button forge-button--primary"
    : "forge-button forge-button--secondary";
  if (options.action) {
    button.dataset["forgeAction"] = options.action;
  }
  Object.entries(options.dataset ?? {}).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  button.disabled = options.disabled === true;
  button.textContent = label;
  return button;
}

function createStatusBadge(
  documentRef: Document,
  value: string,
  tone: "soft" | "warning" | "accent"
): HTMLElement {
  const badge = documentRef.createElement("span");
  badge.className =
    tone === "warning"
      ? "forge-chip forge-chip--warning"
      : tone === "accent"
        ? "forge-chip forge-chip--accent"
        : "forge-chip forge-chip--soft";
  badge.textContent = value;
  return badge;
}

function createGuideCard(
  documentRef: Document,
  titleText: string,
  summaryText: string,
  chips: Array<{
    label: string;
    tone?: "soft" | "warning" | "accent";
  }> = [],
  gateTone: "active" | "blocked" | "locked" | "monitor" = "active"
): HTMLElement {
  const card = documentRef.createElement("article");
  card.className = "forge-state-guide forge-state-guide--gate";
  card.dataset["forgeGateState"] = gateTone;
  const title = documentRef.createElement("strong");
  title.textContent = titleText;
  const summary = documentRef.createElement("p");
  summary.className = "forge-panel__hint";
  summary.textContent = summaryText;
  card.append(title, summary);
  if (chips.length > 0) {
    const meta = documentRef.createElement("div");
    meta.className = "forge-flow-item__meta";
    chips.forEach((chip) => {
      meta.append(createStatusBadge(documentRef, chip.label, chip.tone ?? "soft"));
    });
    card.append(meta);
  }
  return card;
}

function describeOutputState(
  flowState: ForgeWorkbenchUiFlowState,
  options: {
    exportBlockedReason: string | null;
    synthesisBlockedReason: string | null;
  }
): {
  summary: string;
  title: string;
  tone: "active" | "blocked" | "locked" | "monitor";
} {
  switch (flowState) {
    case "IDLE":
    case "SESSION_CREATED":
    case "GOAL_DEFINED":
    case "DRAFT_READY":
    case "APPROVED":
    case "DISPATCHED":
      return {
        title: "OUTPUT GATE LOCKED",
        summary: "REQUIRES: RESPONSES",
        tone: "locked",
      };
    case "RESPONSES_READY":
      return {
        title: "OUTPUT GATE READY",
        summary: options.synthesisBlockedReason ?? "NEXT ACTION: GENERATE SYNTHESIS",
        tone: "active",
      };
    case "CONFLICT":
      return {
        title: "OUTPUT GATE BLOCKED",
        summary: "REQUIRES: CONFLICT RESOLUTION",
        tone: "blocked",
      };
    case "SYNTHESIS_READY":
      return {
        title: "OUTPUT GATE OPEN",
        summary: options.exportBlockedReason ?? "NEXT ACTION: SELECT SYNTHESIS",
        tone: "active",
      };
    case "EXPORTED":
      return {
        title: "OUTPUT GATE ARCHIVE",
        summary: "STATE: EXPORT COMPLETE",
        tone: "monitor",
      };
  }
}

function toOutputStatusLabel(
  exportSummary: ForgeUiState["snapshot"]["exportSummary"],
  flowState: ForgeWorkbenchUiFlowState
): string {
  if (flowState === "EXPORTED") {
    return "shipped";
  }
  if (exportSummary.exportReady) {
    return "ready";
  }
  if (exportSummary.selectedSynthesisId === null) {
    return "needs selection";
  }
  if (exportSummary.openConflictCount > 0) {
    return "needs decision";
  }
  if (exportSummary.acceptanceCriteriaCount === 0) {
    return "needs criteria";
  }
  return "blocked";
}

export function renderSynthesisPanel(
  documentRef: Document,
  state: ForgeUiState,
  text: (path: string[], fallback: string) => string,
  options: {
    expandedSynthesisIds: Set<string>;
    exportBlockedReason: string | null;
    flowState: ForgeWorkbenchUiFlowState;
    synthesisBlockedReason: string | null;
  }
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const exportSummary = state.snapshot.exportSummary;
  const outputState = describeOutputState(options.flowState, options);
  const selectedSynthesis =
    state.snapshot.syntheses.find((entry) => entry.id === state.snapshot.selectedSynthesisId) ??
    null;

  body.append(
    createGuideCard(
      documentRef,
      outputState.title,
      outputState.summary,
      [
        { label: `${String(state.snapshot.responses.length)} answers` },
        {
          label: `${String(state.snapshot.conflicts.filter((conflict) => conflict.status === "open").length)} decisions left`,
          tone:
            state.snapshot.conflicts.filter((conflict) => conflict.status === "open").length > 0
              ? "warning"
              : "soft",
        },
        { label: `${String(state.snapshot.syntheses.length)} syntheses` },
      ],
      outputState.tone
    )
  );

  if (options.flowState === "SYNTHESIS_READY" || options.flowState === "EXPORTED") {
    const readiness = documentRef.createElement("div");
    readiness.className = "forge-output-status";
    readiness.append(
      createStatusBadge(
        documentRef,
        toOutputStatusLabel(exportSummary, options.flowState),
        exportSummary.exportReady
          ? "accent"
          : exportSummary.status === "missing-criteria"
            ? "warning"
            : "soft"
      )
    );
    const readinessText = documentRef.createElement("p");
    readinessText.className = "forge-panel__hint";
    readinessText.textContent = exportSummary.exportReady
      ? "STATE: HANDOFF READY"
      : (options.exportBlockedReason ?? "BLOCKER: HANDOFF CHECK");
    readiness.append(readinessText);
    body.append(readiness);

    const selectedCard = documentRef.createElement("div");
    selectedCard.className = "forge-selected-synthesis";
    if (selectedSynthesis) {
      const selectedExpanded = options.expandedSynthesisIds.has(selectedSynthesis.id);
      const head = documentRef.createElement("div");
      head.className = "forge-selected-synthesis__head";
      const title = documentRef.createElement("strong");
      title.textContent = selectedSynthesis.summary;
      const chips = documentRef.createElement("div");
      chips.className = "forge-flow-item__meta";
      chips.append(
        createStatusBadge(documentRef, "selected", "accent"),
        createStatusBadge(
          documentRef,
          `${String(selectedSynthesis.acceptanceCriteria.length)} criteria`,
          "soft"
        )
      );
      head.append(title, chips);
      selectedCard.append(head);
      selectedCard.append(
        createButton(documentRef, selectedExpanded ? "Collapse" : "Expand", {
          dataset: {
            forgeToggleSynthesis: selectedSynthesis.id,
          },
        })
      );
      if (selectedExpanded) {
        const bodyText = documentRef.createElement("p");
        bodyText.className = "forge-response-option__body";
        bodyText.textContent = selectedSynthesis.body;
        selectedCard.append(bodyText);
      }
    } else {
      const empty = documentRef.createElement("p");
      empty.className = "forge-panel__hint";
      empty.textContent = "REQUIRES: SELECTED SYNTHESIS";
      selectedCard.append(empty);
    }
    body.append(selectedCard);

    if (state.snapshot.syntheses.length > 0) {
      const list = documentRef.createElement("div");
      list.className = "forge-card-list";
      state.snapshot.syntheses.forEach((synthesis) => {
        const expanded = options.expandedSynthesisIds.has(synthesis.id);
        const card = documentRef.createElement("article");
        card.className = "forge-card forge-card--synthesis";
        card.dataset["selected"] =
          synthesis.id === state.snapshot.selectedSynthesisId ? "true" : "false";

        const header = documentRef.createElement("div");
        header.className = "forge-card__header";
        const title = documentRef.createElement("strong");
        title.textContent = synthesis.summary;
        const meta = documentRef.createElement("div");
        meta.className = "forge-flow-item__meta";
        meta.append(
          createStatusBadge(documentRef, `${String(synthesis.sourceTaskIds.length)} tasks`, "soft"),
          createStatusBadge(
            documentRef,
            `${String(synthesis.selectedResponseIds.length)} answers`,
            "soft"
          ),
          createStatusBadge(
            documentRef,
            `${String(synthesis.unresolvedConflictIds.length)} decisions left`,
            synthesis.unresolvedConflictIds.length > 0 ? "warning" : "soft"
          )
        );
        header.append(title, meta);
        card.append(header);

        const actionRail = documentRef.createElement("div");
        actionRail.className = "forge-actions";
        actionRail.append(
          createButton(documentRef, expanded ? "Collapse" : "Expand", {
            dataset: {
              forgeToggleSynthesis: synthesis.id,
            },
          })
        );
        if (options.flowState === "SYNTHESIS_READY") {
          actionRail.append(
            createButton(
              documentRef,
              synthesis.id === state.snapshot.selectedSynthesisId ? "Selected" : "Select",
              {
                dataset: {
                  forgeSelectSynthesis: synthesis.id,
                },
                disabled: synthesis.id === state.snapshot.selectedSynthesisId,
              }
            )
          );
        }
        card.append(actionRail);

        if (expanded) {
          const bodyText = documentRef.createElement("p");
          bodyText.className = "forge-response-option__body";
          bodyText.textContent = synthesis.body;
          card.append(bodyText);
        }
        list.append(card);
      });
      body.append(list);
    }
  }

  if (state.snapshot.exports.length > 0) {
    const exportList = documentRef.createElement("ol");
    exportList.className = "forge-list forge-list--compact";
    state.snapshot.exports.slice(0, 3).forEach((entry) => {
      const item = documentRef.createElement("li");
      item.className = "forge-list__item";
      const title = documentRef.createElement("strong");
      title.textContent = entry.filePath.split("/").at(-1) ?? entry.filePath;
      const meta = documentRef.createElement("span");
      meta.className = "forge-field__hint";
      meta.textContent = `${entry.createdAt} • ${entry.targetRoomId}`;
      item.append(title, meta);
      exportList.append(item);
    });
    body.append(exportList);
  }

  return createForgePanel(documentRef, {
    panelId: "synthesis",
    title: text(["workbench", "panels", "synthesis"], "Synthesis & Export"),
    body,
  });
}
