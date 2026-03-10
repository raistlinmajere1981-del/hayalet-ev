import assert from "node:assert/strict";
import test from "node:test";

import { scrapeMessages } from "../../src/js/modules/webview/providers/chatgpt/scraper.ts";

type MockMessageNode = {
  innerText: string;
  textContent: string;
  getAttribute: (name: string) => string | null;
  closest: (selector: string) => MockMessageNode | null;
  querySelectorAll: (selector: string) => unknown[];
  getBoundingClientRect: () => { left: number };
  contains: (node: unknown) => boolean;
};

function withMockDom(node: MockMessageNode, fn: () => void): void {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousDocument = (globalThis as { document?: unknown }).document;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerWidth: 1280,
      __app_provider_config: {
        scrapeSelectors: {
          preferred: "[data-message-author-role]",
          fallback: ".message-bubble, .markdown.prose",
        },
      },
    },
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelectorAll: () => [node],
    },
  });

  try {
    fn();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
}

test("chatgpt scraper reads message text when innerText is empty in hidden render state", () => {
  const node: MockMessageNode = {
    innerText: "",
    textContent: "Hidden page response",
    getAttribute: (name: string) => (name === "data-message-author-role" ? "assistant" : null),
    closest: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0 }),
    contains: () => false,
  };

  withMockDom(node, () => {
    const messages = scrapeMessages();

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.role, "assistant");
    assert.equal(messages[0]?.text, "Hidden page response");
  });
});
