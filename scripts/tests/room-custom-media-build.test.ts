import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWorkspaceRoomOutput } from "../../electron/rooms/workspace-room-build-support.ts";

void test("room builds resolve named breakpoints without modifying source CSS", async () => {
  const root = await mkdtemp(join(tmpdir(), "hev-room-css-"));
  try {
    const source = join(root, "source");
    const output = join(root, "output");
    await mkdir(source);
    const tokens = "@custom-media --room-small (max-width: 720px);\n:root { --size: 1rem; }";
    const consumer =
      "@media (--room-small) and (orientation: landscape) { .card { width: var(--size); } }\n@media (min-width: 900px) { .card { display: grid; } }";
    await writeFile(join(source, "tokens.css"), tokens);
    await writeFile(join(source, "style.css"), consumer);
    await buildWorkspaceRoomOutput(source, output);
    assert.equal(await readFile(join(source, "style.css"), "utf8"), consumer);
    assert.equal(await readFile(join(source, "tokens.css"), "utf8"), tokens);
    const compiled = await readFile(join(output, "style.css"), "utf8");
    assert.match(compiled, /@media \(max-width: 720px\) and \(orientation: landscape\)/);
    assert.match(compiled, /@media \(min-width: 900px\)/);
    assert.match(compiled, /width: var\(--size\)/);
    assert.doesNotMatch(await readFile(join(output, "tokens.css"), "utf8"), /@custom-media/);
    await writeFile(join(source, "style.css"), "@media (--missing) { .card { display: none; } }");
    await assert.rejects(
      buildWorkspaceRoomOutput(source, output),
      /Unknown room custom media token --missing/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
