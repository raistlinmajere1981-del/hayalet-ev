import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const I18N_DIR = join(process.cwd(), "rooms/repair-room/i18n");

function collectKeyPaths(obj: Record<string, unknown>, prefix: string[] = []): Set<string> {
  const paths = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = [...prefix, key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const sub of collectKeyPaths(value as Record<string, unknown>, path)) {
        paths.add(sub);
      }
    } else {
      paths.add(path.join("."));
    }
  }
  return paths;
}

void test("repair-room i18n catalog parity: en.json and tr.json share identical key paths", () => {
  const en = JSON.parse(readFileSync(join(I18N_DIR, "en.json"), "utf8")) as Record<string, unknown>;
  const tr = JSON.parse(readFileSync(join(I18N_DIR, "tr.json"), "utf8")) as Record<string, unknown>;

  const enKeys = collectKeyPaths(en);
  const trKeys = collectKeyPaths(tr);

  const missingInTr = [...enKeys].filter((k) => !trKeys.has(k));
  const missingInEn = [...trKeys].filter((k) => !enKeys.has(k));
  const extras = [...enKeys].filter((k) => !trKeys.has(k) || !enKeys.has(k));

  assert.equal(
    missingInTr.length,
    0,
    `Keys present in en.json but missing in tr.json (${missingInTr.length}):\n  ${missingInTr.join("\n  ")}`
  );
  assert.equal(
    missingInEn.length,
    0,
    `Keys present in tr.json but missing in en.json (${missingInEn.length}):\n  ${missingInEn.join("\n  ")}`
  );
  assert.equal(enKeys.size, trKeys.size, `Key count mismatch: en=${enKeys.size} tr=${trKeys.size}`);
});
