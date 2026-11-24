import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

const roomEditor = fileURLToPath(new URL(".", import.meta.url));
const output = resolve(roomEditor, "../../.build/gaia-room");
const upstream = resolve(output, "openplan3d");
const patch = resolve(roomEditor, "openplan3d.patch");
const commit = "771c9e1ad30bd1c3cc7584d6eca74deb2e14943d";
const origin = "https://github.com/laanlabs/openPlan3D.git";
const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trimEnd();

const diff = (checkout) =>
  git(
    checkout,
    "-c",
    "core.abbrev=7",
    "diff",
    "--no-color",
    "--no-ext-diff",
    "--no-renames",
    "HEAD"
  );
const expectedPatch = readFileSync(patch, "utf8").trimEnd();
const isPrepared =
  existsSync(resolve(upstream, ".git")) &&
  git(upstream, "rev-parse", "HEAD") === commit &&
  diff(upstream) === expectedPatch;

if (!isPrepared) {
  mkdirSync(output, { recursive: true });
  const staging = mkdtempSync(resolve(output, "openplan3d-"));
  try {
    git(staging, "init", "--quiet");
    git(staging, "fetch", "--quiet", "--depth=1", origin, commit);
    git(staging, "sparse-checkout", "set", "--no-cone", "/src/lib/", "/LICENSE");
    git(staging, "checkout", "--quiet", "--detach", commit);
    git(staging, "apply", "--check", patch);
    git(staging, "apply", patch);
    if (diff(staging) !== expectedPatch)
      throw new Error("Generated OpenPlan3D patch differs from the pinned patch");
    rmSync(upstream, { recursive: true, force: true });
    renameSync(staging, upstream);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

const modules = resolve(upstream, "node_modules");
const localModules = resolve(roomEditor, "node_modules");
if (
  lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink() &&
  readlinkSync(modules) !== localModules
)
  unlinkSync(modules);
if (!existsSync(modules)) symlinkSync(localModules, modules, "junction");
if (
  !readFileSync(resolve(upstream, "LICENSE")).equals(
    readFileSync(resolve(roomEditor, "OPENPLAN3D-LICENSE"))
  )
)
  throw new Error("The OpenPlan3D license differs from the pinned source notice");
