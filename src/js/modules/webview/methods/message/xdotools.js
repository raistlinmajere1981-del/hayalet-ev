/**
 * XDotools message method
 * System-level input simulation for message sending
 */

export async function sendMessage(webview, { message }) {
  const fullText = ` ${message}`;

  // Focus on input field first
  const focusScript = `(function() {
    const config = window.__hayalet_provider_config;
    if (!config || !config.selectors?.inputField) {
      return false;
    }

    const textarea = document.querySelector(config.selectors.inputField);
    if (textarea) {
      textarea.focus();
      if (typeof textarea.value !== 'undefined') textarea.value = '';
      if (typeof textarea.textContent !== 'undefined') textarea.textContent = '';
      return true;
    }
    return false;
  })();`;

  const focused = await webview.executeJavaScript(focusScript);
  if (!focused) {
    return { success: false, message: "Composer textarea/div bulunamadı" };
  }

  // Type message character by character
  try {
    for (const ch of fullText) {
      webview.sendInputEvent({ type: "char", keyCode: ch });
    }
  } catch (err) {
    return {
      success: false,
      message: `Metin yazılamadı: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    success: true,
    message: "Mesaj karakter karakter yazıldı",
  };
}
