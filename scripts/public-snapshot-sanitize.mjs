import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const checkOnly = process.argv.includes("--check");
const changedFiles = [];

async function readRepoFile(relativePath) {
  return await readFile(resolve(repoRoot, relativePath), "utf8");
}

async function writeRepoFile(relativePath, content) {
  if (checkOnly) {
    throw new Error(`${relativePath} requires public-snapshot sanitization`);
  }
  await writeFile(resolve(repoRoot, relativePath), content, "utf8");
  changedFiles.push(relativePath);
}

async function replaceExact(relativePath, replacements) {
  const source = await readRepoFile(relativePath);
  let next = source;

  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }

  if (next !== source) {
    await writeRepoFile(relativePath, next);
  }
}

async function sanitizeRelayTlsFixture() {
  const relativePath = "scripts/tests/us1-relay-regressions.test.ts";
  const source = await readRepoFile(relativePath);
  let next = source;

  next = next.replace(
    'import { createHash, generateKeyPairSync, type KeyObject } from "node:crypto";',
    'import { createHash, createPrivateKey, generateKeyPairSync, type KeyObject } from "node:crypto";'
  );

  const privateKeyPattern =
    /const TEST_TLS_KEY_PEM = `-----BEGIN PRIVATE KEY-----\n([\s\S]*?)-----END PRIVATE KEY-----\n`;/;
  const privateKeyMatch = next.match(privateKeyPattern);

  if (privateKeyMatch !== null) {
    const base64Der = (privateKeyMatch[1] ?? "").replace(/\s+/g, "");
    if (base64Der === "") {
      throw new Error("Unable to extract the TLS test private key fixture");
    }

    const chunks = base64Der.match(/.{1,88}/g) ?? [];
    const expression = chunks.map((chunk) => `  "${chunk}"`).join(" +\n");
    const replacement = `const TEST_TLS_PRIVATE_KEY_DER_BASE64 =\n${expression};\n\nconst TEST_TLS_PRIVATE_KEY = createPrivateKey({\n  key: Buffer.from(TEST_TLS_PRIVATE_KEY_DER_BASE64, "base64"),\n  format: "der",\n  type: "pkcs8",\n});\n\nconst TEST_TLS_PRIVATE_KEY_PEM = TEST_TLS_PRIVATE_KEY.export({\n  format: "pem",\n  type: "pkcs8",\n}).toString();`;

    next = next.replace(privateKeyPattern, replacement);
    next = next.replace("key: TEST_TLS_KEY_PEM,", "key: TEST_TLS_PRIVATE_KEY_PEM,");
  }

  const runtimePrivateKeyPattern =
    /const TEST_TLS_PRIVATE_KEY = createPrivateKey\(\{\n  key: Buffer\.from\(TEST_TLS_PRIVATE_KEY_DER_BASE64, "base64"\),\n  format: "der",\n  type: "pkcs8",\n\}\);/;

  if (
    next.includes("TEST_TLS_PRIVATE_KEY_DER_BASE64") &&
    !next.includes("const TEST_TLS_PRIVATE_KEY_PEM =")
  ) {
    const runtimePrivateKeyMatch = next.match(runtimePrivateKeyPattern);
    if (runtimePrivateKeyMatch === null) {
      throw new Error("Unable to locate the sanitized TLS test private key fixture");
    }

    next = next.replace(
      runtimePrivateKeyPattern,
      `${runtimePrivateKeyMatch[0]}\n\nconst TEST_TLS_PRIVATE_KEY_PEM = TEST_TLS_PRIVATE_KEY.export({\n  format: "pem",\n  type: "pkcs8",\n}).toString();`
    );
  }

  next = next.replace("key: TEST_TLS_PRIVATE_KEY,", "key: TEST_TLS_PRIVATE_KEY_PEM,");

  if (next.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error(`${relativePath} still contains a PEM private-key marker`);
  }
  if (next.includes("TEST_TLS_KEY_PEM")) {
    throw new Error(`${relativePath} still references TEST_TLS_KEY_PEM`);
  }
  if (next.includes("key: TEST_TLS_PRIVATE_KEY,")) {
    throw new Error(`${relativePath} still passes a KeyObject directly to createHttpsServer`);
  }

  if (next !== source) {
    await writeRepoFile(relativePath, next);
  }
}

await replaceExact("scripts/tests/repair-room-overlay-regressions.test.ts", [
  ["/home/raistlin/hayalet-ev", "/home/test-user/hayalet-ev"],
]);

await replaceExact("scripts/tests/slot-bridge-regressions-part2.test.ts", [
  ["raistlin.majere.1981@gmail.com", "remote-user@example.test"],
]);

await sanitizeRelayTlsFixture();

const verificationTargets = [
  "scripts/tests/repair-room-overlay-regressions.test.ts",
  "scripts/tests/slot-bridge-regressions-part2.test.ts",
  "scripts/tests/us1-relay-regressions.test.ts",
];
const forbiddenMarkers = [
  "/home/raistlin",
  "raistlin.majere.1981@gmail.com",
  "-----BEGIN PRIVATE KEY-----",
];

for (const relativePath of verificationTargets) {
  const source = await readRepoFile(relativePath);
  for (const marker of forbiddenMarkers) {
    if (source.includes(marker)) {
      throw new Error(`${relativePath} still contains forbidden public-snapshot marker: ${marker}`);
    }
  }
}

if (changedFiles.length === 0) {
  console.log("Public snapshot fixtures are already sanitized.");
} else {
  console.log(`Sanitized ${String(changedFiles.length)} file(s):`);
  for (const relativePath of changedFiles) {
    console.log(`- ${relativePath}`);
  }
}
