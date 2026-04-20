import { renderCompactCard } from "../components/compact-card.js";
export function renderProfileStage(_deps) {
  return {
    main: renderCompactCard({
      eyebrow: "Legacy",
      title: "Profile Merged",
      body: `<p class="labx-panel-hint">Profile controls moved into Source and Edit. This surface is kept only for backward compatibility.</p>`
    }),
    side: ""
  };
}
