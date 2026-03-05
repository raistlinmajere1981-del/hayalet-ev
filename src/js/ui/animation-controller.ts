/**
 * Animation Controller
 *
 * GSAP wrapper for consistent animations throughout the app.
 * Provides simplified API for common animation patterns.
 *
 * @example
 * ```typescript
 * import { Anim } from './ui';
 *
 * // Simple animations
 * Anim.fadeIn(element);
 * Anim.fadeOut(element);
 * Anim.slideIn(element, 'left');
 *
 * // Timeline for complex sequences
 * const tl = Anim.timeline();
 * tl.add(Anim.fadeIn(el1))
 *   .add(Anim.slideIn(el2, 'bottom'), '-=0.2');
 *
 * // Stagger animations
 * Anim.stagger('.card', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, 0.1);
 *
 * // Draggable (for games)
 * Anim.makeDraggable('.piece', { bounds: '.board' });
 * ```
 */

import { gsap } from "gsap";
import { Logger } from "../modules/logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { DEFAULT_DURATION, SLIDE_DISTANCE } from "@ui-constants";

export type AnimationDirection = "left" | "right" | "top" | "bottom";

export interface AnimationOptions {
  duration?: number;
  delay?: number;
  ease?: string;
  onStart?: () => void;
  onComplete?: () => void;
}

export interface StaggerOptions extends AnimationOptions {
  stagger?: number | gsap.StaggerVars;
}

export interface DraggableOptions {
  bounds?: string | Element;
  onDragStart?: (e: Event) => void;
  onDrag?: (e: Event) => void;
  onDragEnd?: (e: Event) => void;
  snap?: { x?: number | number[]; y?: number | number[] };
  inertia?: boolean;
}

const DEFAULT_EASE = "power2.out";

function withOptionalCallbacks(
  vars: gsap.TweenVars,
  onStart?: () => void,
  onComplete?: () => void
): gsap.TweenVars {
  return {
    ...vars,
    ...(onStart ? { onStart } : {}),
    ...(onComplete ? { onComplete } : {}),
  };
}

gsap.defaults({
  duration: DEFAULT_DURATION,
  ease: DEFAULT_EASE,
});

const animationController = {
  get gsap(): typeof gsap {
    return gsap;
  },

  fadeIn(target: gsap.TweenTarget, options: AnimationOptions = {}): gsap.core.Tween {
    const {
      duration = DEFAULT_DURATION,
      delay = 0,
      ease = DEFAULT_EASE,
      onStart,
      onComplete,
    } = options;

    return gsap.fromTo(
      target,
      { opacity: 0, visibility: "visible" },
      withOptionalCallbacks(
        {
          opacity: 1,
          duration,
          delay,
          ease,
        },
        onStart,
        onComplete
      )
    );
  },

  fadeOut(target: gsap.TweenTarget, options: AnimationOptions = {}): gsap.core.Tween {
    const {
      duration = DEFAULT_DURATION,
      delay = 0,
      ease = DEFAULT_EASE,
      onStart,
      onComplete,
    } = options;

    return gsap.to(
      target,
      withOptionalCallbacks(
        {
          opacity: 0,
          duration,
          delay,
          ease,
          onCompleteParams: [target],
        },
        onStart,
        onComplete
      )
    );
  },

  slideIn(
    target: gsap.TweenTarget,
    direction: AnimationDirection = "bottom",
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const {
      duration = DEFAULT_DURATION,
      delay = 0,
      ease = "power2.out",
      onStart,
      onComplete,
    } = options;

    const fromVars: gsap.TweenVars = { opacity: 0, visibility: "visible" };

    switch (direction) {
      case "left":
        fromVars.x = -SLIDE_DISTANCE;
        break;
      case "right":
        fromVars.x = SLIDE_DISTANCE;
        break;
      case "top":
        fromVars.y = -SLIDE_DISTANCE;
        break;
      case "bottom":
        fromVars.y = SLIDE_DISTANCE;
        break;
    }

    return gsap.fromTo(
      target,
      fromVars,
      withOptionalCallbacks(
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration,
          delay,
          ease,
        },
        onStart,
        onComplete
      )
    );
  },

  slideOut(
    target: gsap.TweenTarget,
    direction: AnimationDirection = "bottom",
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const {
      duration = DEFAULT_DURATION,
      delay = 0,
      ease = "power2.in",
      onStart,
      onComplete,
    } = options;

    const toVars: gsap.TweenVars = withOptionalCallbacks(
      {
        opacity: 0,
        duration,
        delay,
        ease,
      },
      onStart,
      onComplete
    );

    switch (direction) {
      case "left":
        toVars.x = -SLIDE_DISTANCE;
        break;
      case "right":
        toVars.x = SLIDE_DISTANCE;
        break;
      case "top":
        toVars.y = -SLIDE_DISTANCE;
        break;
      case "bottom":
        toVars.y = SLIDE_DISTANCE;
        break;
    }

    return gsap.to(target, toVars);
  },

  pop(target: gsap.TweenTarget, options: AnimationOptions = {}): gsap.core.Tween {
    const { duration = 0.4, delay = 0, ease = "elastic.out(1, 0.5)", onComplete } = options;

    return gsap.fromTo(
      target,
      { scale: 0, opacity: 0 },
      withOptionalCallbacks(
        {
          scale: 1,
          opacity: 1,
          duration,
          delay,
          ease,
        },
        undefined,
        onComplete
      )
    );
  },

  shake(target: gsap.TweenTarget, options: AnimationOptions = {}): gsap.core.Tween {
    const { duration = 0.4, onComplete } = options;

    return gsap.to(
      target,
      withOptionalCallbacks(
        {
          keyframes: [
            { x: -5, duration: duration / 5 },
            { x: 5, duration: duration / 5 },
            { x: -5, duration: duration / 5 },
            { x: 5, duration: duration / 5 },
            { x: 0, duration: duration / 5 },
          ],
          ease: "power2.inOut",
        },
        undefined,
        onComplete
      )
    );
  },

  pulse(target: gsap.TweenTarget, options: AnimationOptions = {}): gsap.core.Tween {
    const { duration = 0.6, onComplete } = options;

    return gsap.fromTo(
      target,
      { scale: 1 },
      withOptionalCallbacks(
        {
          scale: 1.05,
          duration: duration / 2,
          ease: "power2.out",
          yoyo: true,
          repeat: 1,
        },
        undefined,
        onComplete
      )
    );
  },

  timeline(config?: gsap.TimelineVars): gsap.core.Timeline {
    return gsap.timeline(config);
  },

  stagger(
    targets: gsap.TweenTarget,
    fromVars: gsap.TweenVars,
    toVars: gsap.TweenVars,
    stagger: number | gsap.StaggerVars = 0.1
  ): gsap.core.Tween {
    return gsap.fromTo(targets, fromVars, {
      ...toVars,
      stagger,
    });
  },

  staggerFadeIn(targets: gsap.TweenTarget, options: StaggerOptions = {}): gsap.core.Tween {
    const { duration = DEFAULT_DURATION, delay = 0, stagger = 0.1, onComplete } = options;

    return gsap.fromTo(
      targets,
      { opacity: 0, y: 10 },
      withOptionalCallbacks(
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
        },
        undefined,
        onComplete
      )
    );
  },

  set(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.set(target, vars);
  },

  to(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.to(target, vars);
  },

  from(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.from(target, vars);
  },

  fromTo(
    target: gsap.TweenTarget,
    fromVars: gsap.TweenVars,
    toVars: gsap.TweenVars
  ): gsap.core.Tween {
    return gsap.fromTo(target, fromVars, toVars);
  },

  kill(target: gsap.TweenTarget): void {
    gsap.killTweensOf(target);
  },

  pauseAll(): void {
    gsap.globalTimeline.pause();
  },

  resumeAll(): void {
    gsap.globalTimeline.resume();
  },

  /**
   * Make element draggable
   * Note: Requires GSAP Draggable plugin (Club GreenSock)
   * This is a placeholder for future implementation
   */
  makeDraggable(target: gsap.DOMTarget, _options: DraggableOptions = {}): void {
    Logger.debug(
      LogCategory.UI_ANIMATION,
      "Draggable requires GSAP Club plugin - not available in free version",
      { target }
    );
  },
};

export { animationController as AnimationController, animationController as Anim };
