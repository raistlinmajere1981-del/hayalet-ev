import assert from "node:assert/strict";
import test from "node:test";
import {
  CHATGPT_NEW_CONVERSATION_PROBE,
  waitForChatGptNewConversation,
} from "../../src/js/modules/commands/chatgpt-session-readiness.ts";

void test("waits for the composer after SPA navigation", async () => {
  let polls = 0;
  assert.equal(
    await waitForChatGptNewConversation(
      {
        async executeJavaScript() {
          polls++;
          if (polls === 1) throw new Error("navigation");
          return polls >= 3;
        },
      },
      1000,
      5
    ),
    true
  );
  assert.equal(polls, 3);
});

void test("never accepts a missing editor or old conversation after timeout", async () => {
  assert.equal(
    await waitForChatGptNewConversation(
      {
        async executeJavaScript() {
          return false;
        },
      },
      30,
      5
    ),
    false
  );
});

void test("probe requires a fresh ChatGPT home and visible editable composer", () => {
  const run = new Function(
    "location",
    "document",
    "getComputedStyle",
    "return " + CHATGPT_NEW_CONVERSATION_PROBE
  );
  const editor = {
    getBoundingClientRect: () => ({ width: 100, height: 30 }),
    matches: () => false,
  };
  const doc = {
    readyState: "complete",
    querySelector: () => null,
    querySelectorAll: () => [editor],
  };
  const style = () => ({ display: "block", visibility: "visible" });
  const home = { origin: "https://chatgpt.com", pathname: "/" };
  assert.equal(run(home, doc, style), true);
  assert.equal(run({ ...home, pathname: "/c/existing" }, doc, style), false);
  assert.equal(run(home, { ...doc, querySelector: () => editor }, style), false);
  assert.equal(
    run(home, doc, () => ({ display: "none", visibility: "hidden" })),
    false
  );
  assert.equal(run(home, { ...doc, querySelectorAll: () => [] }, style), false);
});
