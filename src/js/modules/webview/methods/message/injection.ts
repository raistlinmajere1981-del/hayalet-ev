/**
 * Message injection method
 * Provider-agnostic implementation using runtime config
 */

interface InjectResult {
  success?: boolean;
  message?: string;
  inputType?: string;
  providerId?: string;
}

interface WebviewElement extends HTMLElement {
  executeJavaScript: (code: string) => Promise<InjectResult | undefined>;
  sendInputEvent: (event: { type: string; keyCode: string }) => void;
}

export async function sendMessage(webview: WebviewElement, { message }: { message: string }) {
  // JSON.stringify ile mesajı güvenli hale getir - newline'lar korunur ("\n" olarak)
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

    // ProseMirror editör kontrolü (ChatGPT ve benzeri)
    // ProseMirror class'ı varsa veya içinde ProseMirror elementleri varsa
    const isProseMirror = textarea.classList.contains('ProseMirror') || 
                          textarea.querySelector('.ProseMirror') ||
                          textarea.querySelector('[class*="ProseMirror"]') ||
                          textarea.id === 'prompt-textarea';

    if (isProseMirror || textarea.contentEditable === 'true' || textarea.isContentEditable) {
      textarea.focus();
      
      // Önce mevcut içeriği temizle
      textarea.innerHTML = '';
      
      // ProseMirror için her satırı ayrı <p> elementi olarak ekle
      // Bu newline'ları doğru şekilde korur
      const lines = message.split('\\n');
      const html = lines.map(line => {
        // Boş satırlar için <br> ekle
        if (line.trim() === '') {
          return '<p><br></p>';
        }
        // HTML karakterlerini escape et
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return '<p>' + escaped + '</p>';
      }).join('');
      
      textarea.innerHTML = html;
      textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      
      return {
        success: true,
        message: 'Mesaj ProseMirror/contenteditable içine yazıldı',
        providerId: config.id,
        inputType: inputType,
        isProseMirror: isProseMirror
      };
    }

    // Standard textarea için value kullan - newline'lar otomatik korunur
    textarea.focus();
    
    // Önce mevcut içeriği temizle
    textarea.value = '';
    
    textarea.value = message;

    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

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
        if (ch === "\n") {
          // Newline için Shift+Enter - executeJavaScript ile simüle et
          // sendInputEvent modifiers düzgün çalışmıyor
          await webview.executeJavaScript(`(function() {
            const config = window.__hayalet_provider_config;
            const inputSelector = config?.selectors?.inputField;
            const el = inputSelector ? document.querySelector(inputSelector) : document.activeElement;
            if (!el) return;
            
            // Shift+Enter simülasyonu
            const keydownEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              shiftKey: true,
              bubbles: true,
              cancelable: true
            });
            el.dispatchEvent(keydownEvent);
            
            // Textarea ise value'ya newline ekle
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
              const start = el.selectionStart || el.value.length;
              const end = el.selectionEnd || el.value.length;
              el.value = el.value.substring(0, start) + '\\n' + el.value.substring(end);
              el.selectionStart = el.selectionEnd = start + 1;
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            const keyupEvent = new KeyboardEvent('keyup', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              shiftKey: true,
              bubbles: true,
              cancelable: true
            });
            el.dispatchEvent(keyupEvent);
          })();`);
        } else {
          webview.sendInputEvent({ type: "char", keyCode: ch });
        }
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
