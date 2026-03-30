/**
 * Mechanical pass: add explicit `any` on common implicit-any patterns in rooms/.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "rooms");

function walkTs(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Multiline param lists: only plain identifier lines, no `:`, `=`, `(`, comments. */
function annotateMultilineFunctionParams(text) {
  const head =
    "(export async function |export function |return async function |return function |registry\\.\\w+ = function |(?<!export )\\basync function |(?<!export )\\bfunction |= function )";
  const re = new RegExp(
    `${head}([a-zA-Z_$][\\w$]*)\\(\\s*\\n([\\s\\S]*?)\\n\\s*\\) \\{`,
    "g"
  );
  return text.replace(re, (full, lead, name, block) => {
    if (
      block.includes(":") ||
      block.includes("=") ||
      block.includes("(") ||
      block.includes("//") ||
      block.includes("/*")
    ) {
      return full;
    }
    const lines = block.split("\n");
    const params = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(/^([a-zA-Z_$][\w$]*),?$/);
      if (!m) return full;
      params.push(m[1]);
    }
    if (params.length < 1) return full;
    const firstLine = lines.find((l) => l.trim());
    const indent = firstLine ? /^(\s*)/.exec(firstLine)?.[1] ?? "    " : "    ";
    const typed = params.map((p) => `${indent}${p}: any`).join(",\n");
    return `${lead}${name}(\n${typed}\n  ) {`;
  });
}

/** Multiline export: add `: any` to identifier-only param lines when other lines are typed. */
function fixMultilineExportBareParams(text) {
  const re = /\b(export async function|export function) ([a-zA-Z_$][\w$]*)\(\s*\n([\s\S]*?)\n(\s*)\)/g;
  return text.replace(re, (full, kind, name, block, indentClose, offset) => {
    const after = text.slice(offset + full.length);
    if (!/^\s*[\{:]/.test(after)) return full;
    if (block.includes("=") || block.includes("//") || block.includes("/*")) return full;
    const lines = block.split("\n");
    let changed = false;
    const newLines = lines.map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("//") || t.includes("/*")) return line;
      if (t.includes(":")) return line;
      const m = line.match(/^(\s*)([a-zA-Z_$][\w$]*)(\s*,)?\s*$/);
      if (!m) return line;
      changed = true;
      const comma = t.endsWith(",") ? "," : "";
      return `${m[1]}${m[2]}: any${comma}`;
    });
    if (!changed) return full;
    return `${kind} ${name}(\n${newLines.join("\n")}\n${indentClose})`;
  });
}

function applyNParamLine(c, n) {
  const caps = Array.from({ length: n }, () => "([a-zA-Z_$][\\w$]*)").join(",\\s*");
  const typed = Array.from({ length: n }, (_, i) => `$${i + 2}: any`).join(", ");
  const pairs = [
    ["\\bexport async function ([a-zA-Z_$][\\w$]*)", `export async function $1(${typed}) {`],
    ["\\bexport function ([a-zA-Z_$][\\w$]*)", `export function $1(${typed}) {`],
    ["(?<!export )\\basync function ([a-zA-Z_$][\\w$]*)", `async function $1(${typed}) {`],
    ["(?<!export )\\bfunction ([a-zA-Z_$][\\w$]*)", `function $1(${typed}) {`],
    ["= function ([a-zA-Z_$][\\w$]*)", `= function $1(${typed}) {`],
  ];
  let out = c;
  for (const [pfx, repl] of pairs) {
    const re = new RegExp(`${pfx}\\(${caps}\\) \\{`, "g");
    out = out.replace(re, repl);
  }
  return out;
}

function transform(content) {
  let c = content;

  c = c.replace(/\(function \(global\) \{/g, "(function (global: any) {");

  c = c.replace(
    /registry\.(\w+) = function (\w+)\(deps\) \{/g,
    "registry.$1 = function $2(deps: any) {"
  );

  c = c.replace(
    /= function ([a-zA-Z_$][\w$]*)\(\s*\n\s*([a-zA-Z_$][\w$]*)\s*\n\s*\)\s*\{/g,
    "= function $1($2: any) {"
  );

  c = annotateMultilineFunctionParams(c);
  c = fixMultilineExportBareParams(c);

  for (let n = 8; n >= 4; n -= 1) {
    c = applyNParamLine(c, n);
  }

  c = c.replace(
    /\bfunction ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\s*=\s*\{\}\) \{/g,
    "function $1($2: any, $3: any, $4: any = {}) {"
  );
  c = c.replace(
    /\bfunction ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\s*=\s*\{\}\) \{/g,
    "function $1($2: any, $3: any = {}) {"
  );

  c = c.replace(
    /\bexport async function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "export async function $1($2: any, $3: any, $4: any) {"
  );
  c = c.replace(
    /\bexport async function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "export async function $1($2: any, $3: any) {"
  );

  c = c.replace(
    /\bexport function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "export function $1($2: any, $3: any, $4: any) {"
  );
  c = c.replace(
    /\bexport function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "export function $1($2: any, $3: any) {"
  );

  c = c.replace(
    /(?<!export )\basync function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "async function $1($2: any, $3: any, $4: any) {"
  );
  c = c.replace(
    /(?<!export )\basync function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "async function $1($2: any, $3: any) {"
  );

  c = c.replace(
    /(?<!export )\bfunction ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "function $1($2: any, $3: any, $4: any) {"
  );
  c = c.replace(
    /(?<!export )\bfunction ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "function $1($2: any, $3: any) {"
  );

  c = c.replace(
    /= function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "= function $1($2: any, $3: any, $4: any) {"
  );
  c = c.replace(
    /= function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\) \{/g,
    "= function $1($2: any, $3: any) {"
  );

  c = c.replace(
    /\bexport async function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\) \{/g,
    "export async function $1($2: any) {"
  );
  c = c.replace(
    /\bexport function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\) \{/g,
    "export function $1($2: any) {"
  );
  c = c.replace(
    /(?<!export )\basync function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\) \{/g,
    "async function $1($2: any) {"
  );
  c = c.replace(
    /(?<!export )\bfunction ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\) \{/g,
    "function $1($2: any) {"
  );

  c = c.replace(/\bfunction \(([a-zA-Z_$][\w$]*)\) \{/g, "function ($1: any) {");

  for (let n = 6; n >= 2; n -= 1) {
    const caps = Array.from({ length: n }, () => "([a-zA-Z_$][\\w$]*)").join(",\\s*");
    const typed = Array.from({ length: n }, (_, i) => `$${i + 1}: any`).join(", ");
    c = c.replace(new RegExp(`function \\(${caps}\\)`, "g"), `function (${typed})`);
  }

  c = c.replace(
    /\bexport async function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\)(\s*:\s*)/g,
    "export async function $1($2: any)$3"
  );
  c = c.replace(
    /\bexport function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\)(\s*:\s*)/g,
    "export function $1($2: any)$3"
  );
  c = c.replace(
    /(?<!export )\basync function ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\)(\s*:\s*)/g,
    "async function $1($2: any)$3"
  );
  c = c.replace(
    /(?<!export )\bfunction ([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\)(\s*:\s*)/g,
    "function $1($2: any)$3"
  );

  const typedSecond = "([a-zA-Z_$][\\w$]*\\s*:\\s*[^)]+)";
  const firstUntypedPairs = [
    ["\\bexport async function ([a-zA-Z_$][\\w$]*)", "export async function $1"],
    ["\\bexport function ([a-zA-Z_$][\\w$]*)", "export function $1"],
    ["(?<!export )\\basync function ([a-zA-Z_$][\\w$]*)", "async function $1"],
    ["(?<!export )\\bfunction ([a-zA-Z_$][\\w$]*)", "function $1"],
  ];
  for (const [pfx, out] of firstUntypedPairs) {
    c = c.replace(
      new RegExp(
        `${pfx}\\(([a-zA-Z_$][\\w$]*),\\s*${typedSecond}\\) \\{`,
        "g"
      ),
      `${out}($2: any, $3) {`
    );
    c = c.replace(
      new RegExp(
        `${pfx}\\(([a-zA-Z_$][\\w$]*),\\s*${typedSecond}\\)(\\s*:\\s*)`,
        "g"
      ),
      `${out}($2: any, $3)$4`
    );
  }

  c = c.replace(
    /\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\)\s*=>/g,
    "($1: any, $2: any, $3: any) =>"
  );
  c = c.replace(
    /\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\)\s*=>/g,
    "($1: any, $2: any) =>"
  );
  c = c.replace(/\(([a-zA-Z_$][\w$]*)\)\s*=>/g, "($1: any) =>");

  c = c.replace(
    /\(([a-zA-Z_$][\w$]*),\s*([a-zA-Z_$][\w$]*)\)\s*=>\s*\{/g,
    "($1: any, $2: any) => {"
  );
  c = c.replace(/\(([a-zA-Z_$][\w$]*)\)\s*=>\s*\{/g, "($1: any) => {");

  const RESERVED_METHOD = new Set([
    "function",
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "else",
    "do",
    "try",
    "return",
    "throw",
    "static",
    "get",
    "set",
  ]);
  for (let n = 5; n >= 2; n -= 1) {
    const caps = Array.from({ length: n }, () => "([a-zA-Z_$][\\w$]*)").join(",\\s*");
    c = c.replace(
      new RegExp(`\\n([ \\t]+)([a-zA-Z_$][\\w$]*)\\(${caps}\\) \\{`, "g"),
      (full, indent, mname, ...paramNames) => {
        if (RESERVED_METHOD.has(mname)) return full;
        const names = paramNames.slice(0, n);
        if (names.length !== n || names.some((x) => x === undefined)) return full;
        return `\n${indent}${mname}(${names.map((p) => `${p}: any`).join(", ")}) {`;
      }
    );
  }

  c = c.replace(
    /\n([ \t]+)([a-zA-Z_$][\w$]*)\(([a-zA-Z_$][\w$]*)\) \{/g,
    (full, indent, mname, p) => {
      if (RESERVED_METHOD.has(mname)) return full;
      return `\n${indent}${mname}(${p}: any) {`;
    }
  );

  return c;
}

const files = walkTs(root);
let touched = 0;
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    touched += 1;
  }
}
console.log("rooms-ts-bulk-implicit-any: updated", touched, "files");
