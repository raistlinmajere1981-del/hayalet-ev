import { join, dirname } from "node:path";
import { fileExists, isExecutable, resolveExecutableOnPath } from "./android-companion-platform-utils.mjs";
import { runCommand, managedJdkRoot } from "./android-companion-command-runner.mjs";

function parseJavaMajorVersion(output) {
  const text = typeof output === "string" ? output.trim() : "";
  if (text === "") {
    return null;
  }

  const versionToken =
    text.match(/version "([^"]+)"/)?.[1] ?? text.match(/openjdk (\d+(?:\.\d+){0,2})/)?.[1] ?? null;
  if (versionToken == null) {
    return null;
  }

  const major = Number.parseInt(versionToken.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

export function getManagedJdkHome() {
  return join(managedJdkRoot, "current");
}

export async function inspectJavaHome(javaHome) {
  if (typeof javaHome !== "string" || javaHome.trim() === "") {
    return null;
  }

  const candidateHome = javaHome.trim();
  const javaPath = join(candidateHome, "bin", process.platform === "win32" ? "java.exe" : "java");
  if ((await isExecutable(javaPath)) !== true) {
    return null;
  }

  const version = await runCommand(javaPath, ["-version"]).catch(() => null);
  const major = parseJavaMajorVersion(`${version?.stderr ?? ""}\n${version?.stdout ?? ""}`);
  if (major === null || major < 17 || major > 21) {
    return null;
  }

  return {
    javaHome: candidateHome,
    javaPath,
    major,
    source: candidateHome === getManagedJdkHome() ? "managed" : "system",
  };
}

export async function inspectPathJava() {
  const javaPath = await resolveExecutableOnPath("java");
  if (javaPath === null) {
    return null;
  }

  const version = await runCommand(javaPath, ["-version"]).catch(() => null);
  const major = parseJavaMajorVersion(`${version?.stderr ?? ""}\n${version?.stdout ?? ""}`);
  if (major === null || major < 17 || major > 21) {
    return null;
  }

  return {
    javaHome: dirname(dirname(javaPath)),
    javaPath,
    major,
    source: "system",
  };
}

export async function resolveCompatibleJavaRuntime() {
  const fromManaged = await inspectJavaHome(getManagedJdkHome());
  if (fromManaged) {
    return fromManaged;
  }

  const fromHome = await inspectJavaHome(process.env.JAVA_HOME ?? "");
  if (fromHome) {
    return fromHome;
  }

  return await inspectPathJava();
}
