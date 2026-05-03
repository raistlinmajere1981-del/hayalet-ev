import assert from "node:assert/strict";
import test from "node:test";

import { ThinkingTracker } from "../../src/js/modules/traffic/thinking-tracker.ts";
import { TrafficManager } from "../../src/js/modules/traffic-manager.ts";
import { AppState } from "../../src/js/modules/app-state.ts";

function makeTrafficState(lastHref = "https://chatgpt.com") {
  return {
    status: { loading: "idle", thinking: "idle", send: "idle" },
    lastHref,
    lastSendSeen: 0,
    loadingActive: false,
    loadingFromDefaultTransition: false,
    loadingStartTime: 0,
    loadingScrollAppeared: false,
    lastScrollChange: 0,
    lastAutoScrollAt: 0,
    loadingJustEnded: false,
    loadingEndedAt: 0,
    stopButtonLastSeen: 0,
    stopButtonDisappearedAt: 0,
    thinkingJustEnded: false,
    thinkingEndedAt: 0,
    polling: false,
    readyState: "ready",
    sendState: "enabled",
    thinkingState: "idle",
  };
}

test("thinking stays idle when stop button is not visible even if send is detected", () => {
  const tracker = new ThinkingTracker({ thinking: { stopButtonDetectionTimeoutMs: 2000 } });
  const now = Date.now();

  const state = {
    status: { thinking: "idle" },
    lastSendSeen: 0,
    stopButtonLastSeen: 0,
    stopButtonDisappearedAt: 0,
    thinkingJustEnded: false,
    thinkingEndedAt: 0,
  };

  const result = tracker.handleProbe(
    "ai1",
    state,
    { lastSend: now, stopVisible: false, sendState: "enabled", voiceMode: false },
    now
  );

  assert.equal(result.indicator, "idle");
});

test("thinking is busy only while stop button is visible", () => {
  const tracker = new ThinkingTracker({ thinking: { stopButtonDetectionTimeoutMs: 2000 } });
  const now = Date.now();

  const state = {
    status: { thinking: "idle" },
    lastSendSeen: 0,
    stopButtonLastSeen: 0,
    stopButtonDisappearedAt: 0,
    thinkingJustEnded: false,
    thinkingEndedAt: 0,
  };

  const result = tracker.handleProbe(
    "ai1",
    state,
    { lastSend: now, stopVisible: true, sendState: "disabled", voiceMode: false },
    now
  );

  assert.equal(result.indicator, "busy");
});

test("thinking ends with timeout reason when stop button stays hidden without send-ready signals", () => {
  const tracker = new ThinkingTracker({ thinking: { stopButtonDetectionTimeoutMs: 2000 } });
  const now = Date.now();

  const state = {
    status: { thinking: "busy" },
    lastSendSeen: 0,
    stopButtonLastSeen: now - 5_000,
    stopButtonDisappearedAt: 0,
    thinkingJustEnded: false,
    thinkingEndedAt: 0,
  };

  const firstProbe = tracker.handleProbe(
    "ai1",
    state,
    { stopVisible: false, sendState: "missing", voiceMode: false, lastSend: now },
    now
  );
  assert.equal(firstProbe.indicator, "busy");
  assert.equal(firstProbe.event, null);

  state.status.thinking = firstProbe.indicator;

  const secondProbe = tracker.handleProbe(
    "ai1",
    state,
    { stopVisible: false, sendState: "missing", voiceMode: false, lastSend: now },
    now + 2_100
  );

  assert.equal(secondProbe.indicator, "idle");
  assert.equal(secondProbe.event?.type, "thinking-ended");
  assert.equal(secondProbe.event?.reason, "timeout");
});

test("default-page to conversation navigation triggers loading when skip flag is not set", () => {
  const slot = "ai1";
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalState = TrafficManager.state[slot];
  const originalSkip = TrafficManager._skipNextLoading[slot];

  try {
    AppState.getProviderIdForSlot = () => "chatgpt";
    TrafficManager.state[slot] = makeTrafficState("https://chatgpt.com");
    TrafficManager._skipNextLoading[slot] = false;

    TrafficManager._handleNavigation(slot, "https://chatgpt.com/c/abc");

    assert.equal(TrafficManager.state[slot]?.status?.loading, "busy");
    assert.equal(TrafficManager.state[slot]?.loadingActive, true);
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    TrafficManager.state[slot] = originalState;
    TrafficManager._skipNextLoading[slot] = originalSkip;
  }
});

test("loading is forced to idle when thinking becomes busy during loading", async () => {
  const slot = "ai1";
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalState = TrafficManager.state[slot];
  const originalSkip = TrafficManager._skipNextLoading[slot];
  const originalWebview = TrafficManager.webviews[slot];
  const documentScope = globalThis as unknown as {
    document?: { getElementById: (id: string) => HTMLElement | null };
  };
  const originalDocument = documentScope.document;

  try {
    AppState.getProviderIdForSlot = () => "chatgpt";
    TrafficManager.state[slot] = makeTrafficState("https://chatgpt.com");
    TrafficManager._skipNextLoading[slot] = false;
    documentScope.document = { getElementById: () => null };

    const now = Date.now();
    TrafficManager.webviews[slot] = {
      executeJavaScript: async () => ({
        href: "https://chatgpt.com/c/abc",
        sendState: "disabled",
        stopVisible: true,
        voiceMode: false,
        lastSend: now,
        scroll: {
          scrollTop: 0,
          scrollHeight: 200,
          clientHeight: 100,
          atBottom: true,
          lastChange: now,
        },
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      getWebContentsId: () => 1,
      isDestroyed: () => false,
      isLoading: () => false,
      getWebContents: () => ({ isLoading: () => false }),
    };

    TrafficManager._handleNavigation(slot, "https://chatgpt.com/c/abc");
    assert.equal(TrafficManager.state[slot]?.status?.loading, "busy");

    await TrafficManager.probe(slot);

    assert.equal(TrafficManager.state[slot]?.status?.thinking, "busy");
    assert.equal(TrafficManager.state[slot]?.status?.loading, "idle");
    assert.equal(TrafficManager.state[slot]?.loadingActive, false);
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    TrafficManager.state[slot] = originalState;
    TrafficManager._skipNextLoading[slot] = originalSkip;
    documentScope.document = originalDocument;
    if (originalWebview === undefined) {
      delete TrafficManager.webviews[slot];
    } else {
      TrafficManager.webviews[slot] = originalWebview;
    }
  }
});

test("non-default navigation keeps loading busy even if thinking is busy", async () => {
  const slot = "ai1";
  const originalGetProvider = AppState.getProviderIdForSlot;
  const originalState = TrafficManager.state[slot];
  const originalSkip = TrafficManager._skipNextLoading[slot];
  const originalWebview = TrafficManager.webviews[slot];
  const documentScope = globalThis as unknown as {
    document?: { getElementById: (id: string) => HTMLElement | null };
  };
  const originalDocument = documentScope.document;

  try {
    AppState.getProviderIdForSlot = () => "chatgpt";
    TrafficManager.state[slot] = makeTrafficState("https://chatgpt.com/c/start");
    TrafficManager._skipNextLoading[slot] = false;
    documentScope.document = { getElementById: () => null };

    const now = Date.now();
    TrafficManager.webviews[slot] = {
      executeJavaScript: async () => ({
        href: "https://chatgpt.com/c/next",
        sendState: "disabled",
        stopVisible: true,
        voiceMode: false,
        lastSend: now,
        scroll: {
          scrollTop: 0,
          scrollHeight: 200,
          clientHeight: 100,
          atBottom: true,
          lastChange: now,
        },
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      getWebContentsId: () => 1,
      isDestroyed: () => false,
      isLoading: () => false,
      getWebContents: () => ({ isLoading: () => false }),
    };

    TrafficManager._handleNavigation(slot, "https://chatgpt.com/c/next");
    assert.equal(TrafficManager.state[slot]?.status?.loading, "busy");

    await TrafficManager.probe(slot);

    assert.equal(TrafficManager.state[slot]?.status?.thinking, "busy");
    assert.equal(TrafficManager.state[slot]?.status?.loading, "busy");
    assert.equal(TrafficManager.state[slot]?.loadingActive, true);
  } finally {
    AppState.getProviderIdForSlot = originalGetProvider;
    TrafficManager.state[slot] = originalState;
    TrafficManager._skipNextLoading[slot] = originalSkip;
    documentScope.document = originalDocument;
    if (originalWebview === undefined) {
      delete TrafficManager.webviews[slot];
    } else {
      TrafficManager.webviews[slot] = originalWebview;
    }
  }
});
