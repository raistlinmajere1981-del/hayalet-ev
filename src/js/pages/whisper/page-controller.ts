import { AppI18n } from "../../modules/i18n/index.js";
import { closeExternalPage } from "../shared/external-page.js";
import {
  SCENE_TOOL_HOST_HIDE_EVENT,
  SCENE_TOOL_HOST_SHOW_EVENT,
  closeSceneTool,
  type SceneToolEventDetail,
} from "../../scene/tool-pages.js";
import { WhisperDockController } from "./controller.js";
import { applyWhisperStaticTranslations } from "./i18n.js";

export class WhisperPageController {
  private dockController = new WhisperDockController();
  private closeButton: HTMLButtonElement | null = null;
  private pageRoot: HTMLElement | null = null;
  private initialized = false;
  private unsubscribeI18n: (() => void) | null = null;

  init(): void {
    if (this.initialized) {
      return;
    }

    this.pageRoot = document.getElementById("page-whisper");
    this.closeButton = document.getElementById("whisper-page-close") as HTMLButtonElement | null;
    this.closeButton?.addEventListener("click", () => {
      if (this.isSceneEmbedded()) {
        closeSceneTool("whisper");
        return;
      }

      closeExternalPage();
    });

    document.addEventListener(
      SCENE_TOOL_HOST_SHOW_EVENT,
      ((event: CustomEvent<SceneToolEventDetail>) => {
        if (event.detail.tool === "whisper") {
          this.onShow();
        }
      }) as EventListener
    );

    document.addEventListener(
      SCENE_TOOL_HOST_HIDE_EVENT,
      ((event: CustomEvent<SceneToolEventDetail>) => {
        if (event.detail.tool === "whisper") {
          this.onHide();
        }
      }) as EventListener
    );

    this.dockController.init();
    this.applyStaticTranslations();
    this.unsubscribeI18n = AppI18n.subscribe(() => {
      this.applyStaticTranslations();
    });
    this.initialized = true;
  }

  onShow(): void {
    this.dockController.setExpanded(true);
    void this.dockController.render();
    window.requestAnimationFrame(() => {
      const addTextInput = document.getElementById("whisper-add-text");
      if (addTextInput instanceof HTMLTextAreaElement) {
        addTextInput.focus();
      }
    });
  }

  onHide(): void {
    this.dockController.setExpanded(false);
  }

  dispose(): void {
    this.unsubscribeI18n?.();
    this.unsubscribeI18n = null;
  }

  private applyStaticTranslations(): void {
    applyWhisperStaticTranslations(this.pageRoot ?? document);
  }

  private isSceneEmbedded(): boolean {
    return this.pageRoot?.dataset["sceneEmbedded"] === "true";
  }
}
