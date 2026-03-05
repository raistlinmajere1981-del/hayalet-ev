import test from "node:test";
import assert from "node:assert/strict";

import { shouldConvertToGoogleDoc } from "../../electron/googledrive-utils.ts";
import { createMessageDedupeKey } from "../../electron/database/message-dedupe.ts";

test("shouldConvertToGoogleDoc detects text MIME", () => {
  assert.equal(shouldConvertToGoogleDoc("text/plain", "image.png"), true);
});

test("shouldConvertToGoogleDoc falls back to .txt extension", () => {
  assert.equal(shouldConvertToGoogleDoc("image/png", "notes.txt"), true);
});

test("shouldConvertToGoogleDoc falls back to .md extension", () => {
  assert.equal(shouldConvertToGoogleDoc(undefined, "readme.md"), true);
});

test("shouldConvertToGoogleDoc stays false for non-text files", () => {
  assert.equal(shouldConvertToGoogleDoc("image/png", "image.png"), false);
});

test("createMessageDedupeKey keeps same content hash with different index distinct", () => {
  const key1 = createMessageDedupeKey(1, "same-hash");
  const key2 = createMessageDedupeKey(2, "same-hash");
  assert.notEqual(key1, key2);
});

test("createMessageDedupeKey stays stable for same index/hash", () => {
  const key1 = createMessageDedupeKey(5, "h1");
  const key2 = createMessageDedupeKey(5, "h1");
  assert.equal(key1, key2);
});

test("createMessageDedupeKey prioritizes domId when provided", () => {
  const key1 = createMessageDedupeKey(1, "same-hash", "msg-aaa");
  const key2 = createMessageDedupeKey(999, "same-hash", "msg-aaa");
  const key3 = createMessageDedupeKey(1, "same-hash", "msg-bbb");

  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
});
