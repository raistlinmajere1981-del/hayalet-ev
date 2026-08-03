import {
  PATTERN_ROOM_CASE_REVIEW_RESULT_VERSION,
  PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS,
  type PatternRoomCaseReviewConnectionSuggestion,
  type PatternRoomCaseReviewResult,
  type PatternRoomCaseReviewResultItem,
  type PatternRoomCaseReviewSection,
  type PatternRoomCaseReviewSectionKey,
  type PatternRoomCaseReviewWarning,
} from "../types/pattern-room-case-review-result.js";
import type { PatternEdgeType } from "../types/pattern-room-domain.js";

const SECTION_LABELS: Readonly<Record<PatternRoomCaseReviewSectionKey, string>> = {
  observation: "Observation",
  evidence: "Evidence",
  analysis: "Analysis",
  counterArgument: "Counter Argument",
  missingInformation: "Missing Information",
  openQuestions: "Open Questions",
  confidenceNotes: "Confidence Notes",
};

const SECTION_KEY_BY_NORMALIZED_LABEL: Readonly<Record<string, PatternRoomCaseReviewSectionKey>> = {
  observation: "observation",
  observations: "observation",
  evidence: "evidence",
  analysis: "analysis",
  counterargument: "counterArgument",
  counterarguments: "counterArgument",
  missinginformation: "missingInformation",
  openquestions: "openQuestions",
  confidencenotes: "confidenceNotes",
};

const PATTERN_EDGE_TYPES = new Set<PatternEdgeType>([
  "supports",
  "contradicts",
  "references",
  "derived_from",
  "inspired_by",
  "questions",
  "needs_review",
]);

const CONNECTION_TAG_PATTERN =
  /^\[connection\]\s+source=([^;]+);\s*type=([^;]+);\s*target=([^;]+)(?:;\s*note=(.*))?$/i;

type Heading = {
  readonly key: PatternRoomCaseReviewSectionKey | null;
  readonly label: string;
  readonly structural: boolean;
};

function normalizeRawText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function normalizeHeadingLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function readHeading(line: string): Heading | null {
  const trimmed = line.trim();
  if (trimmed === "") {
    return null;
  }

  let label: string | null = null;
  let structural = false;
  const markdown = trimmed.match(/^#{1,6}\s+(.+?)(?:\s+#+)?$/);
  const bracketed = trimmed.match(/^\[([^\]]+)\]$/);
  const suffixed = trimmed.match(/^([A-Za-z][A-Za-z ]+):$/);

  if (markdown !== null) {
    label = markdown[1]?.trim() ?? "";
    structural = true;
  } else if (bracketed !== null) {
    label = bracketed[1]?.trim() ?? "";
    structural = true;
  } else if (suffixed !== null) {
    label = suffixed[1]?.trim() ?? "";
    structural = true;
  } else {
    const normalized = normalizeHeadingLabel(trimmed);
    if (SECTION_KEY_BY_NORMALIZED_LABEL[normalized] !== undefined) {
      label = trimmed;
    }
  }

  if (label === null || label === "") {
    return null;
  }

  return {
    key: SECTION_KEY_BY_NORMALIZED_LABEL[normalizeHeadingLabel(label)] ?? null,
    label,
    structural,
  };
}

function createLineBuckets(): Record<PatternRoomCaseReviewSectionKey, string[]> {
  return {
    observation: [],
    evidence: [],
    analysis: [],
    counterArgument: [],
    missingInformation: [],
    openQuestions: [],
    confidenceNotes: [],
  };
}

function splitSectionItems(lines: readonly string[]): string[] {
  const items: string[] = [];
  let active = "";

  const flush = (): void => {
    const normalized = active.replace(/\s+/g, " ").trim();
    if (normalized !== "") {
      items.push(normalized);
    }
    active = "";
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flush();
      continue;
    }

    const bullet = trimmed.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (bullet !== null) {
      flush();
      active = bullet[1]?.trim() ?? "";
      continue;
    }

    active = active === "" ? trimmed : `${active} ${trimmed}`;
  }

  flush();
  return items;
}

function createWarning(
  code: PatternRoomCaseReviewWarning["code"],
  message: string,
  section: PatternRoomCaseReviewSectionKey | null,
  rawText: string | null
): PatternRoomCaseReviewWarning {
  return Object.freeze({ code, message, section, rawText });
}

function parseConnectionSuggestion(
  rawText: string,
  warnings: PatternRoomCaseReviewWarning[]
): PatternRoomCaseReviewConnectionSuggestion | null {
  const match = rawText.match(CONNECTION_TAG_PATTERN);
  if (match === null) {
    warnings.push(
      createWarning(
        "invalid-connection",
        "Tagged connection did not match the canonical source/type/target grammar.",
        "analysis",
        rawText
      )
    );
    return null;
  }

  const sourceId = match[1]?.trim() ?? "";
  const edgeType = match[2]?.trim() ?? "";
  const targetId = match[3]?.trim() ?? "";
  const note = match[4]?.trim() ?? "";

  if (
    sourceId === "" ||
    targetId === "" ||
    sourceId === targetId ||
    PATTERN_EDGE_TYPES.has(edgeType as PatternEdgeType) === false
  ) {
    warnings.push(
      createWarning(
        "invalid-connection",
        "Tagged connection contains an invalid id or edge type.",
        "analysis",
        rawText
      )
    );
    return null;
  }

  return Object.freeze({
    sourceId,
    edgeType: edgeType as PatternEdgeType,
    targetId,
    note: note === "" ? null : note,
    rawText,
  });
}

function createSection(
  key: PatternRoomCaseReviewSectionKey,
  rawLines: readonly string[],
  rawItems: readonly string[],
  warnings: PatternRoomCaseReviewWarning[],
  connections: PatternRoomCaseReviewConnectionSuggestion[]
): PatternRoomCaseReviewSection {
  const filteredItems =
    key === "analysis"
      ? rawItems.filter((item) => {
          if (/^\[connection\]/i.test(item) === false) {
            return true;
          }
          const connection = parseConnectionSuggestion(item, warnings);
          if (connection !== null) {
            connections.push(connection);
          }
          return false;
        })
      : [...rawItems];

  const items = Object.freeze(
    filteredItems.map((text, index): PatternRoomCaseReviewResultItem => {
      return Object.freeze({
        id: `review-${key}-${String(index + 1).padStart(3, "0")}`,
        section: key,
        text,
      });
    })
  );

  return Object.freeze({
    key,
    label: SECTION_LABELS[key],
    items,
    rawText: normalizeRawText(rawLines.join("\n")),
  });
}

function readSummary(
  sections: Readonly<Record<PatternRoomCaseReviewSectionKey, PatternRoomCaseReviewSection>>
): string {
  const priority: readonly PatternRoomCaseReviewSectionKey[] = [
    "observation",
    "analysis",
    "counterArgument",
    "evidence",
    "missingInformation",
    "openQuestions",
    "confidenceNotes",
  ];
  for (const key of priority) {
    const firstItem = sections[key].items[0];
    if (firstItem !== undefined) {
      return firstItem.text;
    }
  }
  return "";
}

export function parsePatternRoomCaseReviewResult(rawReply: string): PatternRoomCaseReviewResult {
  const rawText = normalizeRawText(rawReply);
  const warnings: PatternRoomCaseReviewWarning[] = [];
  const buckets = createLineBuckets();
  const encountered = new Set<PatternRoomCaseReviewSectionKey>();
  const fallbackLines: string[] = [];
  let currentSection: PatternRoomCaseReviewSectionKey | null = null;
  let foundAllowedHeading = false;

  for (const line of rawText === "" ? [] : rawText.split("\n")) {
    const heading = readHeading(line);
    if (heading !== null) {
      currentSection = heading.key;
      if (heading.key !== null) {
        foundAllowedHeading = true;
        encountered.add(heading.key);
      } else if (heading.structural) {
        warnings.push(
          createWarning(
            "unknown-section",
            `Unknown review section: ${heading.label}`,
            null,
            line.trim()
          )
        );
      }
      continue;
    }

    if (currentSection !== null) {
      buckets[currentSection].push(line);
    } else if (line.trim() !== "") {
      fallbackLines.push(line);
    }
  }

  let fallbackUsed = false;
  if (rawText === "") {
    fallbackUsed = true;
    warnings.push(createWarning("empty-reply", "Review reply was empty.", null, null));
  } else if (foundAllowedHeading === false) {
    fallbackUsed = true;
    buckets.analysis.push(...rawText.split("\n"));
    encountered.add("analysis");
    warnings.push(
      createWarning(
        "malformed-format",
        "No allowed review headings were found; the raw reply was preserved as Analysis.",
        "analysis",
        rawText
      )
    );
  } else if (fallbackLines.length > 0) {
    fallbackUsed = true;
    buckets.analysis.unshift(...fallbackLines, "");
    encountered.add("analysis");
    warnings.push(
      createWarning(
        "malformed-format",
        "Text outside allowed review sections was preserved as Analysis.",
        "analysis",
        normalizeRawText(fallbackLines.join("\n"))
      )
    );
  }

  const connections: PatternRoomCaseReviewConnectionSuggestion[] = [];
  const sectionsRecord = {} as Record<
    PatternRoomCaseReviewSectionKey,
    PatternRoomCaseReviewSection
  >;

  for (const key of PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS) {
    const rawItems = splitSectionItems(buckets[key]);
    const section = createSection(key, buckets[key], rawItems, warnings, connections);
    sectionsRecord[key] = section;
    if (
      encountered.has(key) &&
      section.items.length === 0 &&
      (key !== "analysis" || connections.length === 0)
    ) {
      warnings.push(
        createWarning("empty-section", `${SECTION_LABELS[key]} section was empty.`, key, null)
      );
    }
  }

  const sections = Object.freeze(sectionsRecord);
  const items = Object.freeze(
    PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS.flatMap((key) => sections[key].items)
  );

  return Object.freeze({
    resultVersion: PATTERN_ROOM_CASE_REVIEW_RESULT_VERSION,
    sections,
    items,
    warnings: Object.freeze(warnings),
    confidence: Object.freeze(sections.confidenceNotes.items.map((item) => item.text)),
    missingEvidence: Object.freeze(sections.missingInformation.items.map((item) => item.text)),
    suggestedConnections: Object.freeze(connections),
    openQuestions: Object.freeze(sections.openQuestions.items.map((item) => item.text)),
    summary: readSummary(sections),
    rawText,
    fallbackUsed,
  });
}
