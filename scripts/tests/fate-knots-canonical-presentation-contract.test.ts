import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

void test("canonical Fate Knots acceptance validates renderer-facing presentation cue shapes", () => {
  const canonical = readFileSync(
    "rooms/game-room/main-functions/fate-knots/forge/canonical-universe.ts",
    "utf8"
  );

  assert.match(canonical, /const PRESENTATION_APPLY_TO = new Set/);
  assert.match(canonical, /const PRESENTATION_TIMING = new Set/);
  assert.match(canonical, /function validatePresentationCue\(/);
  assert.match(canonical, /function validateRendererPresentationContract\(/);
  assert.match(canonical, /PRESENTATION_APPLY_TO\.has\(applyTo\)/);
  assert.match(canonical, /PRESENTATION_TIMING\.has\(timing\)/);
  assert.match(canonical, /seenCueIds\.has\(cueId\.trim\(\)\)/);
  assert.match(canonical, /code: "duplicate-id"/);
  assert.match(canonical, /statuses\[\$\{statusIndex\}\]\.presentation/);
  assert.match(canonical, /\.\.\.validateRendererPresentationContract\(normalized\.package\)/);
});
