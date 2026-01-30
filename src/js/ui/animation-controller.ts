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

import { gsap } from 'gsap';
import { LogManager } from '../modules/log-manager';

// ============================================================================
// Types
// ============================================================================

export type AnimationDirection = 'left' | 'right' | 'top' | 'bottom';

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

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DURATION = 0.3;
const DEFAULT_EASE = 'power2.out';

const SLIDE_DISTANCE = 30;

// ============================================================================
// GSAP Configuration
// ============================================================================

// Set GSAP defaults
gsap.defaults({
  duration: DEFAULT_DURATION,
  ease: DEFAULT_EASE,
});

// ============================================================================
// Public API
// ============================================================================

export const AnimationController = {
  /**
   * Get raw GSAP instance for advanced usage
   */
  get gsap() {
    return gsap;
  },

  // === BASIC ANIMATIONS ===

  /**
   * Fade in element
   */
  fadeIn(
    target: gsap.TweenTarget,
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const { duration = DEFAULT_DURATION, delay = 0, ease = DEFAULT_EASE, onStart, onComplete } = options;

    return gsap.fromTo(
      target,
      { opacity: 0, visibility: 'visible' },
      {
        opacity: 1,
        duration,
        delay,
        ease,
        onStart,
        onComplete,
      }
    );
  },

  /**
   * Fade out element
   */
  fadeOut(
    target: gsap.TweenTarget,
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const { duration = DEFAULT_DURATION, delay = 0, ease = DEFAULT_EASE, onStart, onComplete } = options;

    return gsap.to(target, {
      opacity: 0,
      duration,
      delay,
      ease,
      onStart,
      onComplete,
      onCompleteParams: [target],
    });
  },

  /**
   * Slide in from direction
   */
  slideIn(
    target: gsap.TweenTarget,
    direction: AnimationDirection = 'bottom',
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const { duration = DEFAULT_DURATION, delay = 0, ease = 'power2.out', onStart, onComplete } = options;

    const fromVars: gsap.TweenVars = { opacity: 0, visibility: 'visible' };

    switch (direction) {
      case 'left':
        fromVars.x = -SLIDE_DISTANCE;
        break;
      case 'right':
        fromVars.x = SLIDE_DISTANCE;
        break;
      case 'top':
        fromVars.y = -SLIDE_DISTANCE;
        break;
      case 'bottom':
        fromVars.y = SLIDE_DISTANCE;
        break;
    }

    return gsap.fromTo(target, fromVars, {
      opacity: 1,
      x: 0,
      y: 0,
      duration,
      delay,
      ease,
      onStart,
      onComplete,
    });
  },

  /**
   * Slide out to direction
   */
  slideOut(
    target: gsap.TweenTarget,
    direction: AnimationDirection = 'bottom',
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const { duration = DEFAULT_DURATION, delay = 0, ease = 'power2.in', onStart, onComplete } = options;

    const toVars: gsap.TweenVars = {
      opacity: 0,
      duration,
      delay,
      ease,
      onStart,
      onComplete,
    };

    switch (direction) {
      case 'left':
        toVars.x = -SLIDE_DISTANCE;
        break;
      case 'right':
        toVars.x = SLIDE_DISTANCE;
        break;
      case 'top':
        toVars.y = -SLIDE_DISTANCE;
        break;
      case 'bottom':
        toVars.y = SLIDE_DISTANCE;
        break;
    }

    return gsap.to(target, toVars);
  },

  /**
   * Scale pop animation (for buttons, notifications)
   */
  pop(
    target: gsap.TweenTarget,
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const { duration = 0.4, delay = 0, ease = 'elastic.out(1, 0.5)', onComplete } = options;

    return gsap.fromTo(
      target,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration,
        delay,
        ease,
        onComplete,
      }
    );
  },

  /**
   * Shake animation (for errors)
   */
  shake(
    target: gsap.TweenTarget,
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const { duration = 0.4, onComplete } = options;

    return gsap.to(target, {
      keyframes: [
        { x: -5, duration: duration / 5 },
        { x: 5, duration: duration / 5 },
        { x: -5, duration: duration / 5 },
        { x: 5, duration: duration / 5 },
        { x: 0, duration: duration / 5 },
      ],
      ease: 'power2.inOut',
      onComplete,
    });
  },

  /**
   * Pulse animation (for attention)
   */
  pulse(
    target: gsap.TweenTarget,
    options: AnimationOptions = {}
  ): gsap.core.Tween {
    const { duration = 0.6, onComplete } = options;

    return gsap.fromTo(
      target,
      { scale: 1 },
      {
        scale: 1.05,
        duration: duration / 2,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        onComplete,
      }
    );
  },

  // === TIMELINE ===

  /**
   * Create a new timeline
   */
  timeline(config?: gsap.TimelineVars): gsap.core.Timeline {
    return gsap.timeline(config);
  },

  // === STAGGER ANIMATIONS ===

  /**
   * Stagger animation for lists
   */
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

  /**
   * Stagger fade in
   */
  staggerFadeIn(
    targets: gsap.TweenTarget,
    options: StaggerOptions = {}
  ): gsap.core.Tween {
    const { duration = DEFAULT_DURATION, delay = 0, stagger = 0.1, onComplete } = options;

    return gsap.fromTo(
      targets,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger,
        onComplete,
      }
    );
  },

  // === UTILITY ===

  /**
   * Set initial state (no animation)
   */
  set(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.set(target, vars);
  },

  /**
   * Animate to values
   */
  to(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.to(target, vars);
  },

  /**
   * Animate from values
   */
  from(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.from(target, vars);
  },

  /**
   * Animate from/to values
   */
  fromTo(
    target: gsap.TweenTarget,
    fromVars: gsap.TweenVars,
    toVars: gsap.TweenVars
  ): gsap.core.Tween {
    return gsap.fromTo(target, fromVars, toVars);
  },

  /**
   * Kill all animations on target
   */
  kill(target: gsap.TweenTarget): void {
    gsap.killTweensOf(target);
  },

  /**
   * Pause all animations
   */
  pauseAll(): void {
    gsap.globalTimeline.pause();
  },

  /**
   * Resume all animations
   */
  resumeAll(): void {
    gsap.globalTimeline.resume();
  },

  // === FUTURE: DRAGGABLE (requires GSAP plugin) ===

  /**
   * Make element draggable
   * Note: Requires GSAP Draggable plugin (Club GreenSock)
   * This is a placeholder for future implementation
   */
  makeDraggable(
    target: gsap.DOMTarget,
    _options: DraggableOptions = {}
  ): void {
    LogManager.addEvent(
      'AnimationController',
      'warn',
      'Draggable requires GSAP Club plugin - not available in free version',
      { target }
    );
    // Future implementation with Draggable plugin:
    // return Draggable.create(target, options);
  },
};

// Shorter alias
export const Anim = AnimationController;
