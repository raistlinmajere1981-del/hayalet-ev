import test from "node:test";
import assert from "node:assert/strict";
import {
  getTranscriptModelDescriptor,
  resolveTranscriptModelId,
  resolveTranscriptSupportedLanguage,
} from "../../shared/transcript/model-catalog.ts";

test("transcript model policy keeps TR light/full on multilingual models", () => {
  assert.equal(resolveTranscriptModelId("tr", "light"), "tiny");
  assert.equal(resolveTranscriptModelId("tr", "full"), "base");

  const lightDescriptor = getTranscriptModelDescriptor("tiny");
  const fullDescriptor = getTranscriptModelDescriptor("base");

  assert.equal(lightDescriptor?.englishOnly, false);
  assert.equal(fullDescriptor?.englishOnly, false);
});

test("transcript model policy keeps EN light/full on english-only models", () => {
  assert.equal(resolveTranscriptModelId("en", "light"), "tiny.en");
  assert.equal(resolveTranscriptModelId("en", "full"), "base.en");

  const lightDescriptor = getTranscriptModelDescriptor("tiny.en");
  const fullDescriptor = getTranscriptModelDescriptor("base.en");

  assert.equal(lightDescriptor?.englishOnly, true);
  assert.equal(fullDescriptor?.englishOnly, true);
});

test("transcript locale fallback normalizes unknown locales to english support", () => {
  assert.equal(resolveTranscriptSupportedLanguage("tr-TR"), "tr");
  assert.equal(resolveTranscriptSupportedLanguage("en-US"), "en");
  assert.equal(resolveTranscriptSupportedLanguage("de-DE"), "en");
});
