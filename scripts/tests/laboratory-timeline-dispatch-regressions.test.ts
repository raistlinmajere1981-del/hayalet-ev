import assert from "node:assert/strict";
import test from "node:test";
import { createLabTimelineRangeDispatcher } from "../../rooms/laboratory/runtime/controller/lab-timeline-range-dispatcher.ts";

void test("laboratory timeline range dispatcher coalesces drag updates per animation frame", () => {
  const ranges: Array<{ startMs: number; endMs: number }> = [];
  let scheduledCallback: ((timestamp: number) => void) | null = null;
  let frameRequests = 0;
  const dispatcher = createLabTimelineRangeDispatcher(
    function (range) {
      ranges.push(range);
    },
    {
      requestAnimationFrame(callback) {
        frameRequests += 1;
        scheduledCallback = callback;
        return frameRequests;
      },
    }
  );

  dispatcher.queue(10, 20);
  dispatcher.queue(30, 40);

  assert.equal(frameRequests, 1);
  assert.deepEqual(ranges, []);
  assert.ok(scheduledCallback);
  scheduledCallback(0);
  assert.deepEqual(ranges, [{ startMs: 30, endMs: 40 }]);

  dispatcher.queue(50, 60);
  dispatcher.flush();
  assert.deepEqual(ranges, [
    { startMs: 30, endMs: 40 },
    { startMs: 50, endMs: 60 },
  ]);

  dispatcher.queue(70, 80);
  dispatcher.cancel();
  assert.ok(scheduledCallback);
  scheduledCallback(0);
  assert.deepEqual(ranges, [
    { startMs: 30, endMs: 40 },
    { startMs: 50, endMs: 60 },
  ]);
});
