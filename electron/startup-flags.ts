export interface StartupFlags {
  startPage: string | null;
  autoConnect: boolean;
}

const ASSISTANT_START_PAGE = "assistant";
const LEGACY_ASSISTANT_START_PAGE = "asistan";

function readFlagValue(argv: readonly string[], flagName: string): string | null {
  const prefix = `${flagName}=`;
  const raw = argv.find((arg) => arg.startsWith(prefix));
  if (raw === undefined) {
    return null;
  }

  const value = raw.slice(prefix.length).trim();
  return value === "" ? null : value;
}

function normalizeStartPage(startPage: string | null): string | null {
  if (startPage === null || startPage === "") {
    return null;
  }

  return startPage === LEGACY_ASSISTANT_START_PAGE ? ASSISTANT_START_PAGE : startPage;
}

export function parseStartupFlagsFromArgv(argv: readonly string[]): StartupFlags {
  const startPage = normalizeStartPage(
    readFlagValue(argv, "--hayalet-start-page") ?? readFlagValue(argv, "--start-page")
  );

  const autoConnect =
    argv.includes("--hayalet-auto-connect=1") ||
    argv.includes("--hayalet-auto-connect=true") ||
    argv.includes("--hayalet-auto-connect") ||
    argv.includes("--auto-connect");

  return {
    startPage,
    autoConnect,
  };
}

export function buildPreloadAdditionalArguments(flags: StartupFlags): string[] {
  const args: string[] = [];

  const startPage = normalizeStartPage(flags.startPage);
  if (startPage !== null && startPage !== "") {
    args.push(`--hayalet-start-page=${startPage}`);
  }

  if (flags.autoConnect) {
    args.push("--hayalet-auto-connect=1");
  }

  return args;
}
