import assert from "node:assert/strict";
import test from "node:test";

import { buildSessionStats } from "../../electron/logger/core/session-stats.ts";

test("buildSessionStats aggregates totals by level and category", () => {
  const stats = buildSessionStats([
    { level: "info", category: "system" },
    { level: "warning", category: "system" },
    { level: "error", category: "slot" },
    { level: "info", category: "slot" },
  ]);

  assert.equal(stats.totalLogs, 4);
  assert.equal(stats.byLevel.info, 2);
  assert.equal(stats.byLevel.warning, 1);
  assert.equal(stats.byLevel.error, 1);
  assert.equal(stats.byCategory.system, 2);
  assert.equal(stats.byCategory.slot, 2);
  assert.equal(stats.errorCount, 1);
  assert.equal(stats.warningCount, 1);
});
