import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part2.test.ts";
const absolutePath = resolve(repoRoot, path);
let source = await readFile(absolutePath, "utf8");

const previous = `    fireEvent(boardNode, "click");
    assertTextIncludes(readTreeText(environment.app), [
      "Pano detayı",
      "Seyir defteri kaynagi",
      "Uzun rota gozlemlerini temsil eden arka plan kaynak karti.",
    ]);`;

const replacement = `    fireEvent(boardNode, "click");
    const investigationInspector = environment.app.querySelector(
      "[data-pattern-workspace-inspector='true']"
    );
    assert.ok(investigationInspector);
    assert.equal(investigationInspector.dataset["patternWorkspaceInspectorView"], "board");
    assert.ok(
      investigationInspector.querySelector(
        "[data-pattern-investigation-inspector-mode='board']"
      )
    );
    assertTextIncludes(readTreeText(investigationInspector), [
      "Tuval detayı",
      "Seyir defteri kaynagi",
      "Uzun rota gozlemlerini temsil eden arka plan kaynak karti.",
    ]);`;

if (source.includes(replacement)) {
  console.log(`Already current: ${path}`);
} else {
  if (!source.includes(previous)) {
    throw new Error("Required persistent-inspector regression expectation was not found.");
  }
  source = source.replace(previous, replacement);
  if (apply) {
    await writeFile(absolutePath, source.endsWith("\n") ? source : `${source}\n`, "utf8");
  }
  console.log(`${apply ? "Applied" : "Would apply"}: ${path}`);
}
