import type { LabStoreState } from "../models/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";

export function renderProjectWorkspaceOverlay(
  _state: LabStoreState,
  _copy?: LabI18n
): string {
  return `<div id="lab-project-workspace-root" aria-hidden="true"></div>`;
}
