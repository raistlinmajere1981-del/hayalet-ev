function enhanceCommandRoom(room: HTMLElement): void {
  if (room.dataset["patternCommandRoomV12Enhanced"] === "true") {
    return;
  }
  room.dataset["patternCommandRoomV12Enhanced"] = "true";

  const shell = room.closest<HTMLElement>("[data-pattern-workspace-shell='true']");
  const inspectorToggle = shell?.querySelector<HTMLButtonElement>(
    "[data-pattern-workspace-inspector-toggle='true']"
  );
  if (
    shell !== null &&
    shell !== undefined &&
    inspectorToggle !== null &&
    inspectorToggle !== undefined &&
    shell.dataset["patternInspectorOpen"] === "true" &&
    inspectorToggle.disabled === false
  ) {
    inspectorToggle.click();
  }
}

function installCommandRoomEnhancements(): void {
  const app = document.getElementById("app");
  if (app === null) {
    window.setTimeout(installCommandRoomEnhancements, 0);
    return;
  }

  let scheduled = false;
  const run = (): void => {
    scheduled = false;
    app.querySelectorAll<HTMLElement>(".pattern-room-command-room").forEach(enhanceCommandRoom);
  };
  const schedule = (): void => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(run);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(app, { childList: true, subtree: true });
  schedule();
}

installCommandRoomEnhancements();
