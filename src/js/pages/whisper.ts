import { closeSpecialPage } from "../app/navigation.js";
import type { PageController } from "../app/types.js";
import { WhisperDockController } from "./whisper-dock-controller.js";

export class WhisperController implements PageController {
  private readonly whisperPanel = new WhisperDockController();
  private closeButton: HTMLButtonElement | null = null;
  private initialized = false;

  init(): void {
    if (this.initialized) {
      return;
    }

    this.closeButton = document.getElementById("whisper-page-close") as HTMLButtonElement | null;
    this.closeButton?.addEventListener("click", () => {
      closeSpecialPage("whisper");
    });
    this.whisperPanel.init();
    this.initialized = true;
  }

  onShow(): void {
    this.whisperPanel.setExpanded(true);
    void this.whisperPanel.render();
    window.requestAnimationFrame(() => {
      const addTextInput = document.getElementById("whisper-add-text");
      if (addTextInput instanceof HTMLTextAreaElement) {
        addTextInput.focus();
      }
    });
  }
}
