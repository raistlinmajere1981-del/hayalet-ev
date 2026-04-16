import { escapeHtml } from "../../models/lab-types.js";
import { renderStatusChip } from "./status-chip.js";

type StageHeaderOptions = {
  eyebrow: string;
  stageIndex: number;
  stageTotal: number;
  statusLabel?: string | null;
  statusTone?: Parameters<typeof renderStatusChip>[1];
  subtitle: string;
  title: string;
};

export function renderStageHeader(options: StageHeaderOptions) {
  return `
    <header class="labx-stage-header">
      <div class="labx-stage-header__copy">
        <p class="labx-stage-header__eyebrow">
          ${escapeHtml(options.eyebrow)}
          <span>${escapeHtml(`${String(options.stageIndex)}/${String(options.stageTotal)}`)}</span>
        </p>
        <h1 class="labx-stage-header__title">${escapeHtml(options.title)}</h1>
        <p class="labx-stage-header__subtitle">${escapeHtml(options.subtitle)}</p>
      </div>
      ${
        options.statusLabel
          ? `<div class="labx-stage-header__status">${renderStatusChip(
              options.statusLabel,
              options.statusTone || "neutral"
            )}</div>`
          : ""
      }
    </header>
  `;
}
