// Re-export centralized helpers from app.js
export { waitForDomReady } from "../../../app.js";

export function pause(duration = 100) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
