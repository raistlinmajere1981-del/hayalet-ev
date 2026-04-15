import { createForgePanel } from "./panel-shell.js";
function createButton(documentRef, label, options = {}) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = options.primary ? "forge-button forge-button--primary" : "forge-button forge-button--secondary";
  Object.entries(options.dataset ?? {}).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  button.disabled = options.disabled === true;
  button.textContent = label;
  return button;
}
function createMetaChip(documentRef, label, soft = false) {
  const chip = documentRef.createElement("span");
  chip.className = soft ? "forge-chip forge-chip--soft" : "forge-chip";
  chip.textContent = label;
  return chip;
}
function createGuideCard(documentRef, titleText, summaryText, chips = [], tone = "active") {
  const card = documentRef.createElement("article");
  card.className = "forge-state-guide forge-state-guide--gate";
  card.dataset["forgeGateState"] = tone;
  const title = documentRef.createElement("strong");
  title.textContent = titleText;
  const summary = documentRef.createElement("p");
  summary.className = "forge-panel__hint";
  summary.textContent = summaryText;
  card.append(title, summary);
  if (chips.length > 0) {
    const meta = documentRef.createElement("div");
    meta.className = "forge-flow-item__meta";
    chips.forEach((chipLabel) => {
      meta.append(createMetaChip(documentRef, chipLabel, true));
    });
    card.append(meta);
  }
  return card;
}
function describeResponseState(flowState, counts) {
  switch (flowState) {
    case "IDLE":
    case "SESSION_CREATED":
      return {
        title: "CENTER GATE LOCKED",
        summary: "REQUIRES: SAVED GOAL",
        tone: "locked"
      };
    case "GOAL_DEFINED":
    case "DRAFT_READY":
      return {
        title: "CENTER GATE LOCKED",
        summary: "REQUIRES: APPROVED DRAFT",
        tone: "locked"
      };
    case "APPROVED":
      return {
        title: "CENTER GATE LOCKED",
        summary: "REQUIRES: DISPATCH",
        tone: "locked"
      };
    case "DISPATCHED":
      return {
        title: "CENTER GATE OPEN",
        summary: counts.responses > 0 ? "STATE: RESPONSE INBOUND" : "STATE: AWAITING RESPONSES",
        tone: "active"
      };
    case "RESPONSES_READY":
      return {
        title: "CENTER GATE OPEN",
        summary: "STATE: REVIEW RESPONSES",
        tone: "active"
      };
    case "CONFLICT":
      return {
        title: "CENTER GATE BLOCKED",
        summary: counts.openConflicts === 1 ? "REQUIRES: CONFLICT RESOLUTION" : "REQUIRES: CONFLICT RESOLUTION",
        tone: "blocked"
      };
    case "SYNTHESIS_READY":
      return {
        title: "CENTER GATE MONITOR",
        summary: "STATE: READ ONLY",
        tone: "monitor"
      };
    case "EXPORTED":
      return {
        title: "CENTER GATE ARCHIVE",
        summary: "STATE: EXPORT INPUTS",
        tone: "monitor"
      };
  }
}
function toResponseStatusLabel(status) {
  if (status === "selected") {
    return "chosen";
  }
  if (status === "rejected") {
    return "set aside";
  }
  if (status === "captured") {
    return "received";
  }
  return status;
}
export function renderResponsesPanel(documentRef, state, text, options) {
  const body = documentRef.createElement("div");
  body.className = "forge-panel__body";
  const approvedTasks = state.snapshot.approvedTasks.filter((task) => task.level === 1);
  const queuedAssignments = state.snapshot.assignments.filter(
    (assignment) => assignment.status === "queued"
  ).length;
  const openConflictCount = state.snapshot.conflicts.filter(
    (conflict) => conflict.status === "open"
  ).length;
  const responseState = describeResponseState(options.flowState, {
    approvedTasks: approvedTasks.length,
    openConflicts: openConflictCount,
    queuedAssignments,
    responses: state.snapshot.responses.length,
    syntheses: state.snapshot.syntheses.length
  });
  const conflictByTaskId = new Map(
    state.snapshot.conflicts.map((conflict) => [conflict.taskId, conflict])
  );
  const responsesByTaskId = /* @__PURE__ */ new Map();
  state.snapshot.responses.forEach((response) => {
    const bucket = responsesByTaskId.get(response.taskId) ?? [];
    bucket.push(response);
    responsesByTaskId.set(response.taskId, bucket);
  });
  body.append(
    createGuideCard(
      documentRef,
      responseState.title,
      responseState.summary,
      [
        `${String(approvedTasks.length)} tasks`,
        `${String(state.snapshot.responses.length)} answers`,
        `${String(openConflictCount)} decisions left`
      ],
      responseState.tone
    )
  );
  if (approvedTasks.length > 0 && options.flowState !== "IDLE" && options.flowState !== "SESSION_CREATED" && options.flowState !== "GOAL_DEFINED" && options.flowState !== "DRAFT_READY" && options.flowState !== "APPROVED") {
    const list = documentRef.createElement("div");
    list.className = "forge-card-list";
    approvedTasks.forEach((task) => {
      const taskResponses = responsesByTaskId.get(task.id) ?? [];
      const taskAssignments = state.snapshot.assignments.filter(
        (assignment) => assignment.taskId === task.id
      );
      const conflict = conflictByTaskId.get(task.id) ?? null;
      const card = documentRef.createElement("article");
      card.className = "forge-card forge-card--decision";
      const header = documentRef.createElement("div");
      header.className = "forge-card__header";
      const title = documentRef.createElement("strong");
      title.textContent = task.title;
      const summary = documentRef.createElement("p");
      summary.className = "forge-flow-item__summary";
      summary.textContent = task.summary;
      const meta = documentRef.createElement("div");
      meta.className = "forge-flow-item__meta";
      meta.append(
        createMetaChip(documentRef, task.dispatchMode, true),
        createMetaChip(documentRef, `${String(taskResponses.length)} responses`, true),
        createMetaChip(
          documentRef,
          `${String(taskAssignments.filter((assignment) => assignment.status === "queued").length)} queued`,
          true
        )
      );
      if (conflict) {
        meta.append(
          createMetaChip(
            documentRef,
            conflict.status === "resolved" ? "decision made" : "decision needed",
            conflict.status === "resolved"
          )
        );
      }
      header.append(title, summary, meta);
      card.append(header);
      if (taskResponses.length === 0) {
        const empty = documentRef.createElement("p");
        empty.className = "forge-panel__hint";
        empty.textContent = (() => {
          if (options.flowState === "APPROVED") {
            return "Send this task from Plan to start collecting answers.";
          }
          if (taskAssignments.length > 0) {
            return "Waiting for the assigned seat to answer this task.";
          }
          return "This task will start showing answers as soon as it is sent.";
        })();
        card.append(empty);
      } else {
        const responseList = documentRef.createElement("div");
        responseList.className = "forge-response-options";
        taskResponses.forEach((response) => {
          const expanded = options.expandedResponseIds.has(response.id);
          const option = documentRef.createElement("article");
          option.className = "forge-response-option";
          option.dataset["selected"] = response.status === "selected" ? "true" : "false";
          const optionHead = documentRef.createElement("div");
          optionHead.className = "forge-response-option__head";
          optionHead.append(
            createMetaChip(documentRef, response.seatId),
            createMetaChip(documentRef, response.roleId, true),
            createMetaChip(
              documentRef,
              toResponseStatusLabel(response.status),
              response.status !== "selected"
            )
          );
          if (response.artifacts.length > 0) {
            optionHead.append(
              createMetaChip(documentRef, `${String(response.artifacts.length)} artifacts`, true)
            );
          }
          if (response.archiveRef?.messageId) {
            optionHead.append(createMetaChip(documentRef, "trace saved", true));
          }
          const responseSummary = documentRef.createElement("strong");
          responseSummary.textContent = response.summary;
          const toggle = createButton(documentRef, expanded ? "Collapse" : "Expand", {
            dataset: {
              forgeToggleResponse: response.id
            }
          });
          option.append(optionHead, responseSummary, toggle);
          if (expanded) {
            const responseBody = documentRef.createElement("p");
            responseBody.className = "forge-response-option__body";
            responseBody.textContent = response.body;
            option.append(responseBody);
          }
          responseList.append(option);
        });
        card.append(responseList);
      }
      if (conflict) {
        const conflictCard = documentRef.createElement("div");
        conflictCard.className = "forge-conflict-box";
        const conflictInteractive = conflict.status === "open" && options.flowState === "CONFLICT";
        const conflictTitle = documentRef.createElement("strong");
        conflictTitle.textContent = conflict.status === "resolved" ? "DECISION RECORDED" : conflictInteractive ? "SELECT ONE RESPONSE" : "DECISION HOLDS RUN";
        const conflictSummary = documentRef.createElement("p");
        conflictSummary.className = "forge-panel__hint";
        conflictSummary.textContent = conflictInteractive ? conflict.summary : conflict.status === "resolved" ? "STATE: PREFERENCE SAVED" : "USE NEXT STEP TO RETURN HERE.";
        conflictCard.append(conflictTitle, conflictSummary);
        if (conflict.preferredResponseId) {
          const preferredResponse = taskResponses.find((response) => response.id === conflict.preferredResponseId) ?? null;
          const preferredNote = documentRef.createElement("p");
          preferredNote.className = "forge-inline-status";
          preferredNote.textContent = `Current pick: ${preferredResponse?.seatId ?? conflict.preferredResponseId}`;
          conflictCard.append(preferredNote);
        }
        if (conflict.resolutionNote) {
          const note = documentRef.createElement("p");
          note.className = "forge-field__hint";
          note.textContent = conflict.resolutionNote;
          conflictCard.append(note);
        }
        if (conflictInteractive) {
          const preferenceRail = documentRef.createElement("div");
          preferenceRail.className = "forge-actions";
          taskResponses.forEach((response) => {
            preferenceRail.append(
              createButton(documentRef, `Prefer ${response.seatId}`, {
                dataset: {
                  forgeResolveConflict: conflict.id,
                  forgeConflictStatus: "open",
                  forgePreferredResponseId: response.id
                }
              })
            );
          });
          const actionRail = documentRef.createElement("div");
          actionRail.className = "forge-actions";
          actionRail.append(
            createButton(documentRef, "Mark resolved", {
              dataset: {
                forgeResolveConflict: conflict.id,
                forgeConflictStatus: "resolved"
              },
              disabled: conflict.preferredResponseId === null
            }),
            createButton(documentRef, "Leave open", {
              dataset: {
                forgeResolveConflict: conflict.id,
                forgeConflictStatus: "open"
              }
            })
          );
          conflictCard.append(preferenceRail, actionRail);
        }
        card.append(conflictCard);
      }
      list.append(card);
    });
    body.append(list);
  }
  return createForgePanel(documentRef, {
    panelId: "responses",
    title: text(["workbench", "panels", "responses"], "Responses & Decisions"),
    body
  });
}
