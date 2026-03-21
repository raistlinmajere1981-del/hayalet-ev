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
