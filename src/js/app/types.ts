/**
 * App Types
 *
 * Shared type definitions for the app module.
 */

export interface PageController {
  init?: () => Promise<void> | void;
  onShow?: () => void;
  onHide?: () => void;
  dispose?: () => void;
}
