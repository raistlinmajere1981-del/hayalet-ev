import assert from "node:assert/strict";
import test from "node:test";
import { waitForDomReady } from "../../src/js/modules/webview/methods/shared/file-utils.ts";

void test("SPA loading ends without another dom-ready event", async () => {
  let loading = true;
  const target = new EventTarget();
  const webview = {
    isLoading: () => loading,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  setTimeout(() => {
    loading = false;
  }, 20);
  await waitForDomReady(webview, 1000);
  assert.equal(loading, false);
});

void test("DOM wait times out instead of holding a synchronization lock", async () => {
  const target = new EventTarget();
  await assert.rejects(
    waitForDomReady(
      {
        isLoading: () => true,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
      },
      30
    ),
    /Timed out/
  );
});
