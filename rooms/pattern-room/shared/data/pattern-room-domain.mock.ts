import { PATTERN_ROOM_DOMAIN, type PatternRoomDomainData } from "./pattern-room-domain.js";
import { PATTERN_ROOM_DOMAIN_TEST_FIXTURE } from "./testing/pattern-room-domain.fixture.js";

/**
 * Temporary compatibility export for the current Pattern Room runtime and regression suites.
 * Production/runtime execution receives an empty local case. Node test execution receives the
 * isolated regression fixture until remaining tests migrate to explicit fixture imports.
 */
export type PatternRoomDomainMockData = PatternRoomDomainData;

function isPatternRoomRegressionTestRuntime(): boolean {
  const runtimeProcess = (
    globalThis as {
      process?: {
        argv?: readonly string[];
        env?: Readonly<Record<string, string | undefined>>;
      };
    }
  ).process;

  if (runtimeProcess === undefined) {
    return false;
  }

  if (
    runtimeProcess.env?.["NODE_ENV"] === "test" ||
    runtimeProcess.env?.["NODE_TEST_CONTEXT"] !== undefined
  ) {
    return true;
  }

  return (runtimeProcess.argv ?? []).some((argument) => {
    return argument.includes("scripts/tests/") || argument.includes("run-all-tests");
  });
}

export const PATTERN_ROOM_DOMAIN_MOCK: PatternRoomDomainData =
  isPatternRoomRegressionTestRuntime() ? PATTERN_ROOM_DOMAIN_TEST_FIXTURE : PATTERN_ROOM_DOMAIN;
