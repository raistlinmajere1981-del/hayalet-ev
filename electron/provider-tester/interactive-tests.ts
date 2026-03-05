/**
 * Provider Tester - Interactive Tests
 *
 * Tests that interact with the page: input injection, button clicks,
 * send message, file upload, etc.
 *
 * @module electron/provider-tester/interactive-tests
 */

import type { ProviderTestResult } from "../../src/types/provider.ts";
import type { TestContext, ElementCheckResult, InteractiveTestsResult } from "./types.ts";
import { PROVIDER_TEST } from "./types.ts";
export type { InteractiveTestsResult } from "./types.ts";

/**
 * Run all interactive tests
 */
export async function runInteractiveTests(ctx: TestContext): Promise<InteractiveTestsResult> {
  const results: ProviderTestResult[] = [];
  let aborted = false;

  results.push(await testInputFieldAccessibility(ctx));

  results.push(await testSendButtonDisabled(ctx));

  results.push(await testMicrophoneButton(ctx));

  const injectResult = await testTextInjection(ctx);
  results.push(injectResult);
  if (injectResult.status === "fail") {
    return { results, aborted: true };
  }

  results.push(await testSendButtonEnabled(ctx));

  results.push(await testFileUpload(ctx));

  const sendResult = await testSendMessage(ctx);
  results.push(sendResult);
  if (sendResult.status === "fail") {
    aborted = true;
    return { results, aborted };
  }

  results.push(await testStopButtonWhileThinking(ctx));

  results.push(await testUserMessageInspect(ctx));

  results.push(await testAIResponseInspect(ctx));

  return { results, aborted };
}

async function testInputFieldAccessibility(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    const selector = ctx.config.selectors.inputField;
    const script =
      "(function() {" +
      "  try {" +
      "    const input = document.querySelector(" +
      JSON.stringify(selector) +
      ");" +
      "    if (!input) return { exists: false };" +
      "    const rect = input.getBoundingClientRect();" +
      "    const styles = window.getComputedStyle(input);" +
      "    return {" +
      "      exists: true," +
      '      visible: styles.display !== "none" && styles.visibility !== "hidden",' +
      "      tagName: input.tagName," +
      '      type: input.type || "contenteditable",' +
      '      disabled: input.disabled || input.getAttribute("aria-disabled") === "true",' +
      '      placeholder: input.placeholder || input.getAttribute("placeholder"),' +
      "      width: rect.width," +
      "      height: rect.height" +
      "    };" +
      "  } catch (err) {" +
      "    return { exists: false, error: err.message };" +
      "  }" +
      "})()";

    const result = (await ctx.executeScript(script)) as ElementCheckResult;

    if (!result.exists) {
      throw new Error(result.error ?? "Input field not found");
    }

    if (!result.visible) {
      throw new Error("Input field not visible");
    }

    return {
      id: "input-field-accessibility",
      name: "Input Field Accessibility",
      category: "interactive",
      status: "pass",
      message: "Input field is accessible",
      details: {
        selector: ctx.config.selectors.inputField,
        element: result,
      },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      id: "input-field-accessibility",
      name: "Input Field Accessibility",
      category: "interactive",
      status: "fail",
      message: "Input field not accessible",
      details: {
        selector: ctx.config.selectors.inputField,
        error: (error as Error).message,
      },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

async function testSendButtonDisabled(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    const selector = ctx.config.selectors.sendButtonDisabled ?? ctx.config.selectors.sendButton;
    const script = `
      (function() {
        try {
          const btn = document.querySelector(${JSON.stringify(selector)});
          if (!btn) return { exists: false };
          
          return {
            exists: true,
            disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true' || btn.classList.contains('disabled'),
            tagName: btn.tagName,
            classes: btn.className
          };
        } catch (err) {
          return { exists: false, error: err.message };
        }
      })()
    `;

    const result = (await ctx.executeScript(script)) as ElementCheckResult;

    if (!result.exists) {
      return {
        id: "send-button-disabled",
        name: "Send Button (Disabled State)",
        category: "interactive",
        status: "fail",
        message: "Send button not found",
        details: { selector: ctx.config.selectors.sendButton },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    if (result.disabled === true) {
      return {
        id: "send-button-disabled",
        name: "Send Button (Disabled State)",
        category: "interactive",
        status: "pass",
        message: "Send button correctly disabled when input is empty",
        details: { selector: ctx.config.selectors.sendButton, element: result },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    } else {
      return {
        id: "send-button-disabled",
        name: "Send Button (Disabled State)",
        category: "interactive",
        status: "warning",
        message: "Send button is enabled even when input is empty (unexpected)",
        details: { selector: ctx.config.selectors.sendButton, element: result },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    return {
      id: "send-button-disabled",
      name: "Send Button (Disabled State)",
      category: "interactive",
      status: "fail",
      message: "Script failed to execute",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

async function testMicrophoneButton(ctx: TestContext): Promise<ProviderTestResult> {
  const selectorsWithMic = ctx.config.selectors as { microphoneButton?: string };
  if (selectorsWithMic.microphoneButton === undefined || selectorsWithMic.microphoneButton === "") {
    return {
      id: "microphone-button",
      name: "Microphone Button",
      category: "interactive",
      status: "skip",
      message: "No microphone button selector in config",
      duration: 0,
      timestamp: Date.now(),
    };
  }

  return await ctx.testSelector({
    id: "microphone-button",
    name: "Microphone Button",
    selector: selectorsWithMic.microphoneButton,
    category: "interactive",
    checks: ["exists", "visible"],
  });
}

async function testTextInjection(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    const message = PROVIDER_TEST.TEST_MESSAGE;
    const safeMessage = JSON.stringify(message);

    const injectScript = `(function() {
      const message = ${safeMessage};

      const config = window.__hayalet_provider_config;
      if (!config || !config.selectors) {
        throw new Error('Provider config not found');
      }

      const inputSelector = config.selectors.inputField;
      if (!inputSelector) {
        throw new Error('Input selector not found in config');
      }

      const textarea = document.querySelector(inputSelector);
      if (!textarea) {
        throw new Error('Input element not found: ' + inputSelector);
      }

      const inputType = config.inputType || 'direct';

      if (inputType === 'character-by-character') {
        textarea.focus();
        if (typeof textarea.value !== 'undefined') textarea.value = '';
        if (typeof textarea.textContent !== 'undefined') textarea.textContent = '';
        
        let currentValue = '';
        for (let i = 0; i < message.length; i++) {
          currentValue += message[i];
          
          // Use native setter to bypass React's value tracking
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 
            'value'
          ).set;
          nativeInputValueSetter.call(textarea, currentValue);
          
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        return textarea.value;
      }

      const isProseMirror = textarea.classList.contains('ProseMirror') || 
                            !!textarea.querySelector('.ProseMirror') ||
                            !!textarea.querySelector('[class*="ProseMirror"]') ||
                            textarea.id === 'prompt-textarea';

      if (isProseMirror || textarea.contentEditable === 'true' || textarea.isContentEditable) {
        textarea.focus();
        textarea.innerHTML = '';
        
        const lines = message.split('\\n');
        const html = lines.map(line => {
          if (line.trim() === '') return '<p><br></p>';
          const escaped = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          return '<p>' + escaped + '</p>';
        }).join('');
        
        textarea.innerHTML = html;
        textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        
        return textarea.textContent || textarea.innerText;
      }

      textarea.focus();
      textarea.value = '';
      textarea.value = message;
      textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

      return textarea.value;
    })();`;

    const result = (await ctx.executeScript(injectScript)) as string;

    if (result === PROVIDER_TEST.TEST_MESSAGE) {
      return {
        id: "text-injection",
        name: "Text Injection Test",
        category: "interactive",
        status: "pass",
        message: "Test message successfully injected",
        details: { selector: ctx.config.selectors.inputField },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    throw new Error(
      `Injected text mismatch: expected "${PROVIDER_TEST.TEST_MESSAGE}", got "${result}"`
    );
  } catch (error) {
    return {
      id: "text-injection",
      name: "Text Injection Test",
      category: "interactive",
      status: "fail",
      message: "Failed to inject test message",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

async function testSendButtonEnabled(ctx: TestContext): Promise<ProviderTestResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  return await ctx.testSelector({
    id: "send-button-enabled",
    name: "Send Button (Enabled State)",
    selector: ctx.config.selectors.sendButton,
    category: "interactive",
    checks: ["exists", "visible", "enabled"],
  });
}

async function testFileUpload(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();

  if (ctx.config.fileInputSelectors.length === 0) {
    return {
      id: "file-upload",
      name: "File Upload (Drag & Drop)",
      category: "interactive",
      status: "skip",
      message: "No file input selectors in config",
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }

  try {
    const checks = await Promise.all(
      ctx.config.fileInputSelectors.map(async (selector) => {
        const exists = (await ctx.executeScript(
          `(function() { return !!document.querySelector(${JSON.stringify(selector)}); })()`
        )) as boolean;
        return { selector, exists };
      })
    );
    const found = checks.find((item) => item.exists);
    if (found !== undefined) {
      return {
        id: "file-upload",
        name: "File Upload (Drag & Drop)",
        category: "interactive",
        status: "pass",
        message: "File upload element found",
        details: { selector: found.selector },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    return {
      id: "file-upload",
      name: "File Upload (Drag & Drop)",
      category: "interactive",
      status: "fail",
      message: "No file upload element found",
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      id: "file-upload",
      name: "File Upload (Drag & Drop)",
      category: "interactive",
      status: "fail",
      message: "File upload test failed",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

async function testSendMessage(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    const clicked = await ctx.clickElement(ctx.config.selectors.sendButton);
    if (!clicked) throw new Error("Send button click failed");

    const selector = ctx.config.selectors.inputField;
    const cleared = await ctx.waitForCondition(async (): Promise<boolean> => {
      const isEmpty = (await ctx.executeScript(
        "(function() {" +
          "  const input = document.querySelector(" +
          JSON.stringify(selector) +
          ");" +
          "  if (!input) return false;" +
          '  const value = input.value || input.textContent || "";' +
          '  return value.trim() === "";' +
          "})()"
      )) as boolean;
      return Boolean(isEmpty);
    }, 3000);

    if (!cleared) throw new Error("Input field not cleared after send");

    return {
      id: "send-message",
      name: "Send Message Test",
      category: "interactive",
      status: "pass",
      message: "Message sent successfully",
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      id: "send-message",
      name: "Send Message Test",
      category: "interactive",
      status: "fail",
      message: "Failed to send message",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

async function testStopButtonWhileThinking(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();

  try {
    if (ctx.config.selectors.stopButton === "") {
      return {
        id: "stop-button-thinking",
        name: "Stop Button (While AI Thinking)",
        category: "interactive",
        status: "skip",
        message: "No stop button selector in config",
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const selector = ctx.config.selectors.stopButton;
    const script = `
      (function() {
        const stopBtn = document.querySelector(${JSON.stringify(selector)});
        if (!stopBtn) return { exists: false };
        
        const styles = window.getComputedStyle(stopBtn);
        return {
          exists: true,
          visible: styles.display !== 'none' && styles.visibility !== 'hidden',
          disabled: stopBtn.disabled || false,
          tagName: stopBtn.tagName
        };
      })()
    `;

    const result = (await ctx.executeScript(script)) as ElementCheckResult;

    if (result.exists && result.visible) {
      return {
        id: "stop-button-thinking",
        name: "Stop Button (While AI Thinking)",
        category: "interactive",
        status: "pass",
        message: "Stop button visible while AI is thinking",
        details: { selector: ctx.config.selectors.stopButton, element: result },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    } else {
      return {
        id: "stop-button-thinking",
        name: "Stop Button (While AI Thinking)",
        category: "interactive",
        status: "warning",
        message: "Stop button not visible (AI might have finished quickly)",
        details: { selector: ctx.config.selectors.stopButton, element: result },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    return {
      id: "stop-button-thinking",
      name: "Stop Button (While AI Thinking)",
      category: "interactive",
      status: "fail",
      message: "Stop button test failed",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

async function testUserMessageInspect(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const selector = ctx.config.scrapeSelectors.userWrapper ?? ctx.config.scrapeSelectors.preferred;
    const script = `
      (function() {
        const userSelector = ${JSON.stringify(selector)};
        const messages = Array.from(document.querySelectorAll(userSelector));
        const lastMessage = messages[messages.length - 1];
        
        if (!lastMessage) return { found: false };
        
        const rect = lastMessage.getBoundingClientRect();
        const styles = window.getComputedStyle(lastMessage);
        const text = lastMessage.textContent || lastMessage.innerText || '';
        
        return {
          found: true,
          tagName: lastMessage.tagName,
          classes: lastMessage.className,
          textContent: text.trim().slice(0, 100),
          visible: styles.display !== 'none' && styles.visibility !== 'hidden',
          width: rect.width,
          height: rect.height,
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      })()
    `;

    const result = (await ctx.executeScript(script)) as {
      found: boolean;
      textContent?: string;
      visible: boolean;
      enabled: boolean;
      tagName: string;
    };

    if (
      result.found === true &&
      result.textContent?.includes(PROVIDER_TEST.TEST_MESSAGE) === true
    ) {
      return {
        id: "user-message-inspect",
        name: "User Message Inspect",
        category: "scraping",
        status: "pass",
        message: "User message found and inspected successfully",
        details: {
          ...(ctx.config.scrapeSelectors.userWrapper !== undefined &&
          ctx.config.scrapeSelectors.userWrapper !== ""
            ? { selector: ctx.config.scrapeSelectors.userWrapper }
            : {}),
          element: result,
        },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    throw new Error("User message not found or text mismatch");
  } catch (error) {
    return {
      id: "user-message-inspect",
      name: "User Message Inspect",
      category: "scraping",
      status: "fail",
      message: "Failed to inspect user message",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}

async function testAIResponseInspect(ctx: TestContext): Promise<ProviderTestResult> {
  const start = Date.now();
  try {
    const selector =
      ctx.config.scrapeSelectors.assistantWrapper ?? ctx.config.scrapeSelectors.preferred;

    const hasResponse = await ctx.waitForCondition(async () => {
      const count = (await ctx.executeScript(`
        (function() {
          const selector = ${JSON.stringify(selector)};
          return document.querySelectorAll(selector).length;
        })()
      `)) as number;
      return count > 0;
    }, PROVIDER_TEST.TIMEOUT_RESPONSE_WAIT);

    if (!hasResponse) {
      throw new Error("No AI response after 15s");
    }

    const script = `
      (function() {
        const assistantSelector = ${JSON.stringify(selector)};
        const messages = Array.from(document.querySelectorAll(assistantSelector));
        const lastMessage = messages[messages.length - 1];
        
        if (!lastMessage) return { found: false };
        
        const rect = lastMessage.getBoundingClientRect();
        const styles = window.getComputedStyle(lastMessage);
        const text = lastMessage.textContent || lastMessage.innerText || '';
        
        return {
          found: true,
          tagName: lastMessage.tagName,
          classes: lastMessage.className,
          textContent: text.trim().slice(0, 100),
          visible: styles.display !== 'none' && styles.visibility !== 'hidden',
          width: rect.width,
          height: rect.height,
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      })()
    `;

    const result = (await ctx.executeScript(script)) as {
      found: boolean;
      tagName: string;
      visible: boolean;
      enabled: boolean;
      textContent?: string;
    };

    if (result.found === true && result.textContent !== undefined && result.textContent !== "") {
      return {
        id: "ai-response-inspect",
        name: "AI Response Inspect",
        category: "scraping",
        status: "pass",
        message: "AI response found and inspected successfully",
        details: {
          ...(ctx.config.scrapeSelectors.assistantWrapper !== undefined &&
          ctx.config.scrapeSelectors.assistantWrapper !== ""
            ? { selector: ctx.config.scrapeSelectors.assistantWrapper }
            : {}),
          element: result,
        },
        duration: Date.now() - start,
        timestamp: Date.now(),
      };
    }

    throw new Error("AI response not found");
  } catch (error) {
    return {
      id: "ai-response-inspect",
      name: "AI Response Inspect",
      category: "scraping",
      status: "fail",
      message: "Failed to inspect AI response",
      details: { error: (error as Error).message },
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
  }
}
