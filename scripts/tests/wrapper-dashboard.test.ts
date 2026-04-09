import assert from "node:assert/strict";
import test from "node:test";

import { createWrapperDashboard, renderDashboardFrame } from "../lib/wrapper-dashboard.mjs";

test("renderDashboardFrame renders user and developer panes", () => {
  const frame = renderDashboardFrame({
    sessionId: "wr-test",
    phase: "running-app",
    phaseLabel: "çalışıyor",
    userLabel: "KULLANICI",
    userLines: ["Ana uygulama aciliyor."],
    developerLines: ["$ vite", "[vite:stdout] ready in 300 ms"],
    width: 80,
    height: 12,
  });

  assert.match(frame, /Wrapper Session wr-test/);
  assert.match(frame, /KULLANICI çalışıyor/);
  assert.match(frame, /DEV wr-test/);
  assert.match(frame, /Ana uygulama aciliyor\./);
  assert.match(frame, /\$ vite/);
});

test("createWrapperDashboard preserves final frame on dispose by default", () => {
  let output = "";
  const stdout = {
    isTTY: true,
    columns: 80,
    rows: 12,
    write(chunk) {
      output += String(chunk);
    },
  };

  const dashboard = createWrapperDashboard({
    stdout,
    env: { TERM: "xterm-256color" },
    sessionId: "wr-test",
    userLabel: "KULLANICI",
    formatPhaseLabel(phase) {
      return phase === "idle" ? "boşta" : phase;
    },
  });
  dashboard.attach();
  dashboard.user("Calisma dongusu sonlandi.");
  dashboard.dispose();

  assert.match(output, /Calisma dongusu sonlandi\./);
  assert.match(output, /KULLANICI boşta/);
  assert.match(output, /\u001b\[\?25h/);
  assert.doesNotMatch(output, /\u001b\[2J\u001b\[H\u001b\[\?25h$/);
});

test("createWrapperDashboard falls back to plain logs for dumb terminals", () => {
  let output = "";
  const stdout = {
    isTTY: true,
    columns: 80,
    rows: 12,
    write(chunk) {
      output += String(chunk);
    },
  };

  const dashboard = createWrapperDashboard({
    stdout,
    env: { TERM: "dumb" },
    sessionId: "wr-test",
  });
  dashboard.attach();
  dashboard.user("Calisma dongusu sonlandi.");
  dashboard.developer("build tamamlandi");

  assert.match(output, /\[user\] Calisma dongusu sonlandi\./);
  assert.match(output, /\[dev\] build tamamlandi/);
  assert.doesNotMatch(output, /\u001b\[/);
});

test("createWrapperDashboard coalesces burst updates into one frame render", async () => {
  const writes = [];
  const stdout = {
    isTTY: true,
    columns: 80,
    rows: 12,
    write(chunk) {
      writes.push(String(chunk));
    },
  };

  const dashboard = createWrapperDashboard({
    stdout,
    env: { TERM: "xterm-256color" },
    sessionId: "wr-test",
  });
  dashboard.attach();
  writes.length = 0;

  dashboard.user("Calisma dongusu sonlandi.");
  dashboard.developer("build tamamlandi");

  await new Promise((resolve) => {
    setTimeout(resolve, 25);
  });

  const frameWrites = writes.filter((chunk) => chunk.includes("Wrapper Session wr-test"));
  assert.equal(frameWrites.length, 1);
});
