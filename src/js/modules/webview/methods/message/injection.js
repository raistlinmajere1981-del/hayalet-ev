/**
 * Message injection method
 * Provider-agnostic implementation using runtime config
 */

export async function sendMessage(webview, { message }) {
  const safeMessage = JSON.stringify(message);

  const injectScript = `(function() {
    const message = ${safeMessage};

    const config = window.__hayalet_provider_config;
    if (!config || !config.selectors) {
      return { success: false, message: 'Provider config bulunamadı' };
    }

    const inputSelector = config.selectors.inputField;

    if (!inputSelector) {
      return { success: false, message: 'Configde input selector bulunamadi' };
    }

    const textarea = document.querySelector(inputSelector);
    if (!textarea) {
      return { success: false, message: 'Textarea (' + inputSelector + ') bulunamadi' };
    }

    const inputType = config.inputType || 'direct';

    if (inputType === 'character-by-character') {
      textarea.focus();
      if (typeof textarea.value !== 'undefined') textarea.value = '';
      if (typeof textarea.textContent !== 'undefined') textarea.textContent = '';
      return {
        success: true,
        message: 'Textarea temizlendi ve odaklandı',
        providerId: config.id,
        inputType: inputType
      };
    }

    if (textarea.contentEditable === 'true') {
      textarea.focus();
      textarea.textContent = message;
      textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      return {
        success: true,
        message: 'Mesaj contenteditable div içine yazıldı',
        providerId: config.id,
        inputType: inputType
      };
    }

    textarea.value = message;
    if (typeof textarea.textContent !== 'undefined') {
      textarea.textContent = message;
    }

    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    textarea.focus();
    return {
      success: true,
      message: 'Mesaj textarea içine yazıldı',
      providerId: config.id,
      inputType: inputType
    };
  })();`;

  const result = await webview.executeJavaScript(injectScript);
  if (!result?.success) {
    return { success: false, message: result?.message || "Mesaj eklenemedi" };
  }

  if (result.inputType === "character-by-character") {
    const fullText = ` ${message}`;
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
  }

  return {
    success: true,
    message: "Mesaj textarea içine yazıldı",
  };
}
