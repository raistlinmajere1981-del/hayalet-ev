import type { LabStageSurface, LabStoreState } from "../../models/lab-types.js";
import { renderCompactCard } from "../components/compact-card.js";

type ProfileStageRenderDeps = {
  primaryDetail?: string | null;
  primaryDisabled?: boolean;
  primaryLabel: string;
  state: LabStoreState;
};

/**
 * Legacy compatibility surface only.
 * Profile is no longer a standalone user-facing stage in Laboratory v2.2.
 */
export function renderProfileStage(_deps: ProfileStageRenderDeps): LabStageSurface {
  return {
    main: renderCompactCard({
      eyebrow: "Legacy",
      title: "Profile Merged",
      body: `<p class="labx-panel-hint">Profile controls moved into Source and Edit. This surface is kept only for backward compatibility.</p>`,
    }),
    side: "",
  };
}
