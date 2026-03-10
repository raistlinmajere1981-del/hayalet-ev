import { LogCategory } from "@shared/logging-core";
// NOTE: Placeholder; canvas/WebGL features are intentionally not implemented yet.
import { Logger } from "../modules/logger/index.js";

export interface CanvasOptions {
  width?: number;
  height?: number;
  pixelRatio?: number;
  backgroundColor?: string;
}

export interface CanvasInstance {
  element: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  clear: () => void;
  destroy: () => void;
}

const canvasManager = {
  create(container: HTMLElement, options: CanvasOptions = {}): CanvasInstance | null {
    const { width = 800, height = 600, backgroundColor = "transparent" } = options;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.style.backgroundColor = backgroundColor;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        Logger.debugT(LogCategory.UI_CANVAS, "app.logs.uiCanvas.contextUnavailable");
        return null;
      }

      container.appendChild(canvas);

      const instance: CanvasInstance = {
        element: canvas,
        ctx,
        width,
        height,
        clear: () => {
          ctx.clearRect(0, 0, width, height);
        },
        destroy: () => {
          canvas.remove();
        },
      };

      Logger.debugT(LogCategory.UI_CANVAS, "app.logs.uiCanvas.created", undefined, {
        width,
        height,
      });
      return instance;
    } catch (error) {
      Logger.debugT(
        LogCategory.UI_CANVAS,
        "app.logs.uiCanvas.createFailed",
        { message: error instanceof Error ? error.message : String(error) },
        { error }
      );
      return null;
    }
  },

  createBoard(_container: HTMLElement, _gameType: "backgammon" | "chess" | "checkers"): null {
    Logger.warnT(LogCategory.UI_CANVAS, "app.logs.uiCanvas.boardNotImplemented");
    return null;
  },

  isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
      return typeof window.WebGLRenderingContext !== "undefined" && context != null;
    } catch {
      return false;
    }
  },

  isCanvasSupported(): boolean {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("2d");
  },
};

export { canvasManager as CanvasManager, canvasManager as Canvas };
