export interface StartupFlags {
  startPage: string | null;
  autoConnect: boolean;
}

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

  return startPage;
}

export function parseStartupFlagsFromArgv(argv: readonly string[]): StartupFlags {
  const startPage = normalizeStartPage(
    readFlagValue(argv, "--app-start-page") ?? readFlagValue(argv, "--start-page")
  );

  const autoConnect =
    argv.includes("--app-auto-connect=1") ||
    argv.includes("--app-auto-connect=true") ||
    argv.includes("--app-auto-connect") ||
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
    args.push(`--app-start-page=${startPage}`);
  }

  if (flags.autoConnect) {
    args.push("--app-auto-connect=1");
  }

  return args;
}
