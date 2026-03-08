/**
 * App Types
 *
 * app modülü için ortak tip tanımları.
 */

export interface PageController {
  init?: () => Promise<void> | void;
  onShow?: () => void;
  onHide?: () => void;
  dispose?: () => void;
}
