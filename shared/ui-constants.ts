/**
 * Shared UI Constants
 *
 * Animasyon, buton durumu ve scroll sınırı sabitleri.
 * @ui-constants alias ile erişilir.
 */

/** GSAP animasyon varsayılan süresi (saniye) */
export const DEFAULT_DURATION = 0.3;

/** Slide animasyonu mesafesi (px) */
export const SLIDE_DISTANCE = 30;

/** Buton başarı durumu görüntüleme süresi (ms) */
export const DEFAULT_SUCCESS_DURATION = 1500;

/** Buton hata durumu görüntüleme süresi (ms) */
export const DEFAULT_ERROR_DURATION = 2000;

/** Splash screen minimum görüntüleme süresi (ms) */
export const MINIMUM_DISPLAY_TIME = 2000;

/** Splash screen gizleme animasyon süresi (ms) — CSS --duration-slow ile eşleşir */
export const HIDE_ANIMATION_DURATION = 400;

/** Scroll altında sayılma eşiği (px) — konteynır alt kenarına bu kadar yakınsa "altta" sayılır */
export const SCROLL_THRESHOLD = 80;
