import type { PageController } from "../app/types.js";
import { ArchivesPageController } from "./analyze/archive-overlay-controller.js";

export class ArchivesController implements PageController {
  private readonly archives = new ArchivesPageController();

  async init(): Promise<void> {
    await this.archives.init();
  }

  onShow(): void {
    this.archives.onHostShow();
  }

  onHide(): void {
    this.archives.onHostHide();
  }
}
