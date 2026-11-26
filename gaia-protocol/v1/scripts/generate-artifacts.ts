import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { capabilityCatalogDocument, jsonSchemaDocuments } from "../src/schema.ts";

const outputDirectory = fileURLToPath(new URL("../schema/", import.meta.url));
mkdirSync(outputDirectory, { recursive: true });
const prettierConfig = (await prettier.resolveConfig(join(outputDirectory, "artifact.json"))) ?? {};

async function writeArtifact(file: string, value: unknown): Promise<void> {
  const target = join(outputDirectory, file);
  const source = await prettier.format(JSON.stringify(value), {
    ...prettierConfig,
    filepath: target,
    parser: "json",
  });
  writeFileSync(target, source, "utf8");
}

await Promise.all([
  ...Object.entries(jsonSchemaDocuments).map(async ([file, document]) => {
    await writeArtifact(file, document);
  }),
  writeArtifact("capabilities.json", capabilityCatalogDocument),
]);

console.info(
  `Wrote ${Object.keys(jsonSchemaDocuments).length + 1} artifacts to ${outputDirectory}`
);
