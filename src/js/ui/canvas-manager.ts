import { LogCategory } from "@shared/logging-core";
/**
 * Canvas Manager (Placeholder)
 *
 * Future implementation for Canvas/WebGL based visualizations.
 * Planned features:
 * - Game board rendering (tavla, satranç)
 * - Particle effects
 * - Data visualizations
 * - Custom drawing canvas
 *
 * @example
 * ```typescript
 * import { Canvas } from './ui';
 *
 * // Create canvas instance
 * const canvas = Canvas.create(container, { width: 800, height: 600 });
 *
 * // Draw operations
 * canvas.clear();
 * canvas.drawRect(0, 0, 100, 100, '#ff0000');
 * canvas.drawCircle(50, 50, 25, '#00ff00');
 *
 * // Game board
 * const board = Canvas.createBoard(container, 'backgammon');
 * board.setPieces(gameState);
 * board.onMove((from, to) => handleMove(from, to));
 * ```
 */

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
        Logger.debug(LogCategory.UI_CANVAS, "Failed to get 2D context");
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

      Logger.debug(LogCategory.UI_CANVAS, "Canvas created", { width, height });
      return instance;
    } catch (error) {
      Logger.debug(LogCategory.UI_CANVAS, "Failed to create canvas", { error });
      return null;
    }
  },

  createBoard(_container: HTMLElement, _gameType: "backgammon" | "chess" | "checkers"): null {
    Logger.warn(LogCategory.UI_CANVAS, "Game board canvas not yet implemented");
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
