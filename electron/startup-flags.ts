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

export function parseStartupFlagsFromArgv(argv: readonly string[]): StartupFlags {
  const startPage =
    readFlagValue(argv, "--hayalet-start-page") ?? readFlagValue(argv, "--start-page");

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

  if (flags.startPage !== null && flags.startPage !== "") {
    args.push(`--hayalet-start-page=${flags.startPage}`);
  }

  if (flags.autoConnect) {
    args.push("--hayalet-auto-connect=1");
  }

  return args;
}
