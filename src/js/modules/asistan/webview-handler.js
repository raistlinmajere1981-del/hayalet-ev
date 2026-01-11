/**
 * Webview Handler
 * OpenCode web arayüzü için webview yönetimi ve DOM injection
 */

import { getProviderConfig } from "./config.js";

export class WebviewHandler {
  constructor(webviewElement) {
    this.webview = webviewElement;
    this.isLoaded = false;
    this.currentUrl = null;
    this.config = null;
    this.lastMessageCount = 0;
  }

  /**
   * Webview'i başlat ve URL yükle
   */
  async init(url) {
    this.currentUrl = url;
    
    this.config = getProviderConfig("opencode");
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Webview load timeout (30s)"));
      }, 30000);

      const onLoad = () => {
        this.isLoaded = true;
        cleanup();
        
        setTimeout(async () => {
          try {
            await this.analyzeDOM();
          } catch (e) {
            console.warn("[WebviewHandler] DOM analysis failed:", e);
          }
          resolve();
        }, 2000);
      };

      const onError = (event) => {
        console.error("[WebviewHandler] Load error:", event);
        cleanup();
        reject(new Error(`Webview load failed: ${event.errorDescription || "unknown error"}`));
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.webview.removeEventListener("did-finish-load", onLoad);
        this.webview.removeEventListener("did-fail-load", onError);
      };

      this.webview.addEventListener("did-finish-load", onLoad);
      this.webview.addEventListener("did-fail-load", onError);

      this.webview.src = url;
    });
  }

  /**
   * Webview'de script çalıştır
   */
  async executeScript(script) {
    if (!this.isLoaded) {
      console.warn("[WebviewHandler] Not loaded, cannot execute script");
      return null;
    }

    try {
      return await this.webview.executeJavaScript(script);
    } catch (error) {
      console.error("[WebviewHandler] Script execution failed:", error);
      throw error;
    }
  }

  /**
   * DOM yapısını analiz et (debug için)
   */
  async analyzeDOM() {
    const script = `
      (function() {
        const results = {
          textareas: [],
          inputs: [],
          buttons: [],
          contentEditables: [],
          divWithRole: []
        };
        
        document.querySelectorAll('textarea').forEach((el, i) => {
          results.textareas.push({
            index: i,
            placeholder: el.placeholder,
            className: el.className?.substring(0, 100),
            id: el.id,
            dataTestId: el.getAttribute('data-testid')
          });
        });
        
        document.querySelectorAll('input').forEach((el, i) => {
          results.inputs.push({
            index: i,
            type: el.type,
            placeholder: el.placeholder,
            className: el.className?.substring(0, 100),
            id: el.id
          });
        });
        
        document.querySelectorAll('button').forEach((el, i) => {
          results.buttons.push({
            index: i,
            text: el.innerText?.substring(0, 30),
            className: el.className?.substring(0, 100),
            type: el.type,
            ariaLabel: el.getAttribute('aria-label'),
            disabled: el.disabled
          });
        });
        
        document.querySelectorAll('[contenteditable="true"]').forEach((el, i) => {
          results.contentEditables.push({
            index: i,
            className: el.className?.substring(0, 100),
            tagName: el.tagName,
            role: el.getAttribute('role')
          });
        });
        
        document.querySelectorAll('[role="textbox"]').forEach((el, i) => {
          results.divWithRole.push({
            index: i,
            className: el.className?.substring(0, 100),
            tagName: el.tagName
          });
        });
        
        return results;
      })();
    `;
    
    const results = await this.executeScript(script);
    return results;
  }

  /**
   * Input alanını bul (session açık olmalı)
   */
  async findInputElement() {
    const script = `
      (function() {
        const inputSelectors = [
          '[data-component="prompt-input"]',
          '[contenteditable="true"][class*="prompt"]',
          '[contenteditable="true"]',
          '[contenteditable="plaintext-only"]',
          'textarea',
          '[role="textbox"]',
          '.ProseMirror',
          '.tiptap'
        ];
        
        for (const sel of inputSelectors) {
          try {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {
              return {
                found: true,
                selector: sel,
                tagName: el.tagName,
                className: el.className?.substring(0, 100),
                isContentEditable: el.isContentEditable
              };
            }
          } catch (e) {}
        }
        
        return { found: false };
      })();
    `;
    
    return await this.executeScript(script);
  }

  /**
   * Input alanına mesaj yaz ve gönder
   */
  async sendMessage(message) {
    if (!this.isLoaded) {
      throw new Error("Webview henüz yüklenmedi");
    }

    const inputInfo = await this.findInputElement();
    
    if (!inputInfo?.found) {
      await this.analyzeDOM();
      throw new Error("Input alanı bulunamadı - Lütfen OpenCode'da bir proje/session açın");
    }

    this.lastMessageCount = await this.getMessageCount();

    const escapedMessage = message
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");

    const script = `
      (function() {
        const input = document.querySelector('[data-component="prompt-input"]') 
                   || document.querySelector('[contenteditable="true"]')
                   || document.querySelector('textarea');
        
        if (!input) {
          return { success: false, error: 'Input alanı bulunamadı' };
        }
        
        input.focus();
        
        if (input.isContentEditable) {
          input.innerHTML = '';
          input.textContent = '${escapedMessage}';
          
          input.dispatchEvent(new InputEvent('input', { 
            bubbles: true, 
            inputType: 'insertText',
            data: '${escapedMessage}'
          }));
        } else {
          input.value = '${escapedMessage}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        return new Promise((resolve) => {
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            input.dispatchEvent(enterEvent);
            
            resolve({ success: true, method: 'enter' });
          }, 100);
        });
      })();
    `;

    const result = await this.executeScript(script);
    
    if (!result?.success) {
      throw new Error(result?.error || "Mesaj gönderilemedi");
    }
    
    return result;
  }

  /**
   * Session turn (mesaj) sayısını al
   */
  async getMessageCount() {
    const script = `
      (function() {
        const turns = document.querySelectorAll('[data-slot="session-turn-content"]');
        return turns.length;
      })();
    `;
    
    return await this.executeScript(script) || 0;
  }

  /**
   * Son asistan cevabını al
   */
  async getLastResponse() {
    const script = `
      (function() {
        const markdowns = document.querySelectorAll('[data-component="markdown"][data-slot="session-turn-markdown"]');
        
        if (markdowns.length > 0) {
          const lastMarkdown = markdowns[markdowns.length - 1];
          return lastMarkdown.innerText || lastMarkdown.textContent;
        }
        
        // Fallback: Son session turn summary
        const summaries = document.querySelectorAll('[data-slot="session-turn-summary-header"]');
        if (summaries.length > 0) {
          const lastSummary = summaries[summaries.length - 1];
          const markdown = lastSummary.querySelector('[data-component="markdown"]');
          if (markdown) {
            return markdown.innerText || markdown.textContent;
          }
        }
        
        return null;
      })();
    `;
    
    return await this.executeScript(script);
  }

  /**
   * OpenCode thinking/processing durumunu kontrol et
   * "Show steps" butonu yerine animasyonlu icon varsa thinking devam ediyor
   */
  async isThinking() {
    const script = `
      (function() {
        
        const triggers = document.querySelectorAll('[data-slot="session-turn-response-trigger"]');
        if (triggers.length === 0) return false;
        
        const lastTrigger = triggers[triggers.length - 1];
        
        const button = lastTrigger.querySelector('button');
        if (button) {
          const text = button.innerText || button.textContent;
          if (text.includes('Show steps') && /\\d+(\\.\\d+)?s/.test(text)) {
            return false;
          }
        }
        
        const animatedElements = lastTrigger.querySelectorAll('[class*="animate"], svg[class*="spin"], [data-component="loading"]');
        if (animatedElements.length > 0) {
          return true;
        }
        
        const turns = document.querySelectorAll('[data-slot="session-turn-content"]');
        if (turns.length > 0) {
          const lastTurn = turns[turns.length - 1];
          const summary = lastTurn.querySelector('[data-slot="session-turn-summary-section"]');
          if (!summary) {
            return true;
          }
        }
        
        return false;
      })();
    `;
    return await this.executeScript(script);
  }

  /**
   * Yeni cevap gelene kadar bekle
   */
  async waitForResponse(timeout = 120000) {
    const startTime = Date.now();
    const pollInterval = 1000;
    const initialCount = this.lastMessageCount;
    

    await new Promise(resolve => setTimeout(resolve, 1500));

    while (Date.now() - startTime < timeout) {
      const currentCount = await this.getMessageCount();
      
      if (currentCount > initialCount) {
        
        let isThinking = await this.isThinking();
        let thinkingWaitCount = 0;
        
        while (isThinking && thinkingWaitCount < 300) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          isThinking = await this.isThinking();
          thinkingWaitCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await this.getLastResponse();
        if (response) {
          return response;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Cevap zaman aşımına uğradı (${timeout / 1000}s)`);
  }

  /**
   * Webview'i detach et
   */
  detach() {
    if (this.webview) {
      this.webview.src = "about:blank";
      this.isLoaded = false;
      this.currentUrl = null;
    }
  }

  /**
   * Webview'i yeniden yükle
   */
  reload() {
    if (this.webview && this.currentUrl) {
      this.webview.reload();
    }
  }

  /**
   * Webview'i yok et
   */
  destroy() {
    this.detach();
    this.webview = null;
    this.config = null;
  }
}
