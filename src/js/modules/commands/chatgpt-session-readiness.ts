// A successful navigation does not mean ChatGPT's SPA composer has mounted.
export const CHATGPT_NEW_CONVERSATION_PROBE = `(() => {
  if (location.origin !== "https://chatgpt.com" || location.pathname !== "/") return false;
  if (document.readyState === "loading") return false;
  if (document.querySelector('[data-content-search-unit-key$=":user"], [data-message-author-role="user"]')) return false;
  return Array.from(document.querySelectorAll('[data-composer-markdown][contenteditable="true"], #prompt-textarea[contenteditable="true"], textarea#prompt-textarea')).some(el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" &&
      style.visibility !== "hidden" && !el.matches('[disabled], [aria-disabled="true"]');
  });
})()`;

export async function waitForChatGptNewConversation(
  webview: { executeJavaScript(script: string): Promise<unknown> },
  timeoutMs = 20_000,
  pollMs = 250
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const attempt = async (): Promise<boolean> => {
    try {
      // A navigation can temporarily destroy the JavaScript execution context.
      if ((await webview.executeJavaScript(CHATGPT_NEW_CONVERSATION_PROBE)) === true) return true;
    } catch {
      // Retry only the readiness probe, never a message or navigation.
    }
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(pollMs, Math.max(0, deadline - Date.now())))
    );
    return await attempt();
  };
  return await attempt();
}
