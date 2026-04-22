import { escapeHtml } from "../../models/lab-types.js";
export function renderStatusChip(label, tone = "neutral") {
  return `<span class="labx-status-chip" data-tone="${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}
