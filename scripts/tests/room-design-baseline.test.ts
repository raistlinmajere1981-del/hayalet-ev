import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

void test("temporary room design baseline is limited to Fate Knots visual CSS", () => {
  const baseline = JSON.parse(
    readFileSync("scripts/baselines/design-system-audit-rooms-baseline.json", "utf8")
  ) as {
    totalIssues: number;
    issues: Array<{ filePath: string; rule: string; fingerprint: string }>;
  };
  const allowed = new Set([
    "rooms/game-room/main-functions/fate-knots/ui/hub.css",
    "rooms/game-room/main-functions/fate-knots/ui/gameplay.css",
  ]);
  assert.equal(baseline.totalIssues, baseline.issues.length);
  assert.ok(baseline.issues.length <= 282);
  for (const issue of baseline.issues) {
    assert.ok(allowed.has(issue.filePath), issue.filePath);
    assert.ok(["hardcoded-color", "raw-breakpoint-media", "raw-unit-token"].includes(issue.rule));
    assert.ok(issue.fingerprint.includes(issue.filePath));
  }
});
