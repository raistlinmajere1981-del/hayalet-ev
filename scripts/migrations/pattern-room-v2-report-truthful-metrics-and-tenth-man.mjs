import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function updateFile(path, transform) {
  const absolutePath = resolve(repoRoot, path);
  const current = await readFile(absolutePath, "utf8");
  const next = transform(current);
  const normalized = next.endsWith("\n") ? next : `${next}\n`;

  if (normalized === current) {
    return;
  }

  changedFiles.push(path);
  if (apply) {
    await writeFile(absolutePath, normalized, "utf8");
  }
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  if (!source.includes(search)) {
    throw new Error(`Required truthful-report pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Required truthful-report block was not found: ${label}`);
  }
  return `${source.slice(0, start)}${replacement}\n\n${source.slice(end)}`;
}

await updateFile("rooms/pattern-room/shared/types/pattern-room.ts", (source) => {
  let next = replaceRequired(
    source,
    `export type PatternReportSection = {\n  id: string;`,
    `export type PatternReportMetric = {\n  id: string;\n  label: string;\n  value: number;\n};\n\nexport type PatternReportSection = {\n  id: string;`,
    "report metric type"
  );
  next = replaceRequired(
    next,
    `  note: string;\n  bullets: string[];`,
    `  note: string;\n  metrics: PatternReportMetric[];\n  bullets: string[];`,
    "report section metrics"
  );
  return next;
});

await updateFile(
  "rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts",
  (source) => {
    let next = replaceRequired(
      source,
      `  PatternReportItem,\n  PatternReportSection,`,
      `  PatternReportItem,\n  PatternReportMetric,\n  PatternReportSection,`,
      "report metric import"
    );

    next = replaceBetween(
      next,
      "function createReportSection(",
      "function createReportLocalTraceText(",
      `function createReportSection(\n  id: PatternReportSectionId,\n  items: readonly PatternReportItem[],\n  metrics: readonly PatternReportMetric[],\n  note: string = REPORT_SECTION_DEFINITIONS[id].note\n): PatternReportSection {\n  const definition = REPORT_SECTION_DEFINITIONS[id];\n  return {\n    id,\n    label: definition.label,\n    tone: definition.tone,\n    note,\n    metrics: metrics.map((metric) => ({ ...metric })),\n    bullets: items.length === 0 ? [definition.emptyMessage] : items.map(formatReportBullet),\n    items: [...items],\n    emptyMessage: definition.emptyMessage,\n  };\n}`,
      "report section factory"
    );

    next = replaceBetween(
      next,
      "function createSourceSummaryReportItems(",
      "function createEvidenceReportItems(",
      `function createSourceSummaryReportItems(\n  domain: PatternRoomDomainViewSource,\n  overlay?: PatternRoomLocalOverlay\n): PatternReportItem[] {\n  const domainItems = domain.sources.map((source) => {\n    return createReportItem(\n      \`report-domain-source-\${source.id}\`,\n      source.label,\n      adaptSourceNote(source),\n      [\n        \"Domain kaynak\",\n        \`Tür: \${SOURCE_TYPE_LABELS[source.sourceType]}\`,\n        \`Köken: \${source.origin}\`,\n        \`Durum: \${RELIABILITY_LABELS[source.reliability]}\`,\n      ]\n    );\n  });\n  const localItems =\n    overlay?.localAuthoredSources.map((source) => {\n      const segmentCount = source.segments?.length ?? 0;\n      const meta = [\n        \"Kullanıcı tarafından eklenen\",\n        \`Köken: \${source.origin}\`,\n        ...(segmentCount > 0 ? [\`Segment: \${segmentCount}\`] : []),\n      ];\n      const body = source.note === \"\" ? \"Kaynak metni için kısa not yok.\" : source.note;\n      return createReportItem(\`report-source-\${source.id}\`, source.label, body, meta);\n    }) ?? [];\n\n  return [...domainItems, ...localItems];\n}`,
      "source report items"
    );

    next = replaceBetween(
      next,
      "function createTenthManReportItems(",
      "function createNextResearchReportItems(",
      `function createTenthManReportItems(\n  domain: PatternRoomDomainViewSource,\n  overlay?: PatternRoomLocalOverlay\n): PatternReportItem[] {\n  const session = adaptTenthManViewModel(domain, overlay).tenthManSession;\n  const referenceItems = session.references.map((reference) => {\n    const kindLabel =\n      reference.kind === \"source\"\n        ? \"Kaynak referansı\"\n        : reference.kind === \"evidence\"\n          ? \"Kanıt referansı\"\n          : \"Pano referansı\";\n    return createReportItem(\n      \`report-tenth-reference-\${reference.id}\`,\n      reference.label,\n      reference.note,\n      [\"10. Adam referansı\", kindLabel]\n    );\n  });\n  const turnItems =\n    overlay?.debateLocalTurns.map((turn) => {\n      return createReportItem(\n        \`report-tenth-turn-\${turn.id}\`,\n        \`\${DEBATE_ROLE_LABELS[turn.role]} yerel turu\`,\n        createReportLocalTraceText(turn.content),\n        [\"Yerel oturum turu\", \`Faz: \${DEBATE_PHASE_LABELS[turn.phaseKey]}\`]\n      );\n    }) ?? [];\n  const verdict = overlay?.debateLocalVerdict ?? null;\n  const verdictItems =\n    verdict === null\n      ? []\n      : [\n          createReportItem(\n            \"report-tenth-verdict\",\n            \"Yerel tartışma özeti\",\n            createReportLocalTraceText(verdict),\n            [\"Yerel oturum özeti\", \"Henüz doğrulanmamış\"]\n          ),\n        ];\n\n  return [...referenceItems, ...turnItems, ...verdictItems];\n}`,
      "Tenth Man report items"
    );

    next = replaceBetween(
      next,
      "export function adaptReportViewModel(",
      "export function adaptDomainToViewModels(",
      `export function adaptReportViewModel(\n  domain: PatternRoomDomainViewSource,\n  overlay?: PatternRoomLocalOverlay\n): PatternReportViewModel {\n  const sourceItems = createSourceSummaryReportItems(domain, overlay);\n  const evidenceItems = createEvidenceReportItems(overlay);\n  const boardNoteItems = createBoardNoteReportItems(overlay);\n  const connectionItems = createLocalConnectionReportItems(domain, overlay);\n  const tenthManItems = createTenthManReportItems(domain, overlay);\n  const nextResearchItems = createNextResearchReportItems(overlay);\n  const localSourceCount = overlay?.localAuthoredSources.length ?? 0;\n  const debateReferenceCount = overlay?.debateReferenceIds.length ?? 0;\n  const debateTurnCount = overlay?.debateLocalTurns.length ?? 0;\n  const debateSummaryCount = overlay?.debateLocalVerdict === null || overlay === undefined ? 0 : 1;\n\n  const itemsBySection: Record<PatternReportSectionId, PatternReportItem[]> = {\n    \"report-source-summary\": sourceItems,\n    \"report-evidence-notes\": evidenceItems,\n    \"report-board-notes\": boardNoteItems,\n    \"report-local-connections\": connectionItems,\n    \"report-tenth-man-traces\": tenthManItems,\n    \"report-next-research-notes\": nextResearchItems,\n  };\n  const metricsBySection: Record<PatternReportSectionId, PatternReportMetric[]> = {\n    \"report-source-summary\": [\n      { id: \"sources\", label: \"kaynak\", value: sourceItems.length },\n    ],\n    \"report-evidence-notes\": [\n      { id: \"evidence\", label: \"kanıt notu\", value: evidenceItems.length },\n    ],\n    \"report-board-notes\": [\n      { id: \"board-notes\", label: \"pano notu\", value: boardNoteItems.length },\n    ],\n    \"report-local-connections\": [\n      { id: \"connections\", label: \"bağlantı\", value: connectionItems.length },\n    ],\n    \"report-tenth-man-traces\": [\n      { id: \"references\", label: \"referans\", value: debateReferenceCount },\n      { id: \"turns\", label: \"tur\", value: debateTurnCount },\n      { id: \"summary\", label: \"özet\", value: debateSummaryCount },\n    ],\n    \"report-next-research-notes\": [\n      { id: \"research-notes\", label: \"araştırma notu\", value: nextResearchItems.length },\n    ],\n  };\n  const noteBySection: Partial<Record<PatternReportSectionId, string>> = {\n    \"report-source-summary\": \`Archive sayımı: \${domain.sources.length} domain kaynak, \${localSourceCount} yerel kaynak.\`,\n    \"report-tenth-man-traces\":\n      \"Seçilmiş referanslar, yerel oturum turları ve varsa oturum özeti birbirinden ayrı gösterilir.\",\n  };\n  const sections: PatternReportSection[] = REPORT_SECTION_ORDER.map((sectionId) => {\n    return createReportSection(\n      sectionId,\n      itemsBySection[sectionId],\n      metricsBySection[sectionId],\n      noteBySection[sectionId]\n    );\n  });\n\n  return {\n    reportSummary: {\n      id: \`report-summary-\${domain.topic.id}\`,\n      label: \"Taslak rapor terminali\",\n      status: \"dummy\",\n      sections,\n    },\n  };\n}`,
      "report view model"
    );

    return next;
  }
);

await updateFile("rooms/pattern-room/ui/panels/pattern-report-panel.ts", (source) => {
  let next = replaceRequired(
    source,
    `const REPORT_META_SEPARATOR = \" · \";`,
    `const REPORT_META_SEPARATOR = \" · \";\n\nfunction formatReportMetric(value: number, label: string): string {\n  return \`${"${String(value)} ${label}"}\`;\n}\n\nfunction createReportMetrics(section: PatternReportSection): HTMLElement {\n  const metrics = createElement(\"div\", \"pattern-room-report-section-metrics\");\n  metrics.dataset[\"patternReportMetrics\"] = section.id;\n  section.metrics.forEach((metric) => {\n    const item = createElement(\n      \"span\",\n      \"pattern-room-report-section-metric\",\n      formatReportMetric(metric.value, metric.label)\n    );\n    item.dataset[\"patternReportMetric\"] = metric.id;\n    metrics.append(item);\n  });\n  return metrics;\n}\n\nfunction formatReportOutlineMetrics(section: PatternReportSection): string {\n  return section.metrics\n    .map((metric) => formatReportMetric(metric.value, metric.label))\n    .join(REPORT_META_SEPARATOR);\n}`,
    "report metric helpers"
  );

  next = replaceRequired(
    next,
    `      createElement(\"span\", \"pattern-room-list-eyebrow\", \"Taslak bölümü\"),\n      createElement(\"span\", \"pattern-room-report-section-count\", String(section.items.length)),\n      createElement(\"h3\", undefined, section.label),`,
    `      createElement(\"span\", \"pattern-room-list-eyebrow\", \"Taslak bölümü\"),\n      createReportMetrics(section),\n      createElement(\"h3\", undefined, section.label),`,
    "report section metric rendering"
  );

  next = replaceRequired(
    next,
    `      createElement(\"small\", undefined, String(section.items.length))`,
    `      createElement(\"small\", undefined, formatReportOutlineMetrics(section))`,
    "report outline metric rendering"
  );
  return next;
});

await updateFile("rooms/pattern-room/ui/workspace.css", (source) => {
  if (source.includes("TRUTHFUL REPORT METRICS")) {
    return source;
  }
  return `${source.trimEnd()}\n\n/* ─────────────────────────────────────────\n   TRUTHFUL REPORT METRICS\n───────────────────────────────────────── */\n.pattern-room-report-section-metrics {\n  display: flex;\n  flex-wrap: wrap;\n  gap: var(--pattern-px-6);\n}\n\n.pattern-room-report-section-metric {\n  display: inline-flex;\n  width: fit-content;\n  padding: var(--pattern-px-4) var(--pattern-px-8);\n  border: var(--pattern-px-1) solid var(--pattern-text-alpha-14);\n  border-radius: var(--pattern-px-999);\n  font-family: \"IBM Plex Mono\", monospace;\n  color: var(--pattern-text-subtle);\n  font-size: var(--pattern-rem-0-72);\n  font-weight: 700;\n}\n\n.pattern-room-report-outline-button small {\n  text-align: right;\n  line-height: 1.35;\n}\n`;
});

await updateFile("scripts/tests/pattern-room-view-adapters-regressions.test.ts", (source) => {
  if (source.includes("truthful report metrics separate sources, references, turns, and summaries")) {
    return source;
  }
  return `${source.trimEnd()}\n\nvoid test(\"pattern-room truthful report metrics separate sources, references, turns, and summaries\", () => {\n  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);\n  localState.addAuthoredSource(\"Yerel kaynak A\", \"Kullanıcı arşivi\", \"Kaynak A notu.\");\n  localState.addAuthoredSource(\"Yerel kaynak B\", \"Kullanıcı arşivi\", \"Kaynak B notu.\");\n  localState.addToDebate(\"local-source-001\");\n  localState.addToDebate(\"local-source-002\");\n\n  const beforeSession = adaptReportViewModel(\n    PATTERN_ROOM_DOMAIN_TEST_FIXTURE,\n    localState.getOverlay()\n  ).reportSummary;\n  const sourceSection = beforeSession.sections.find((section) => {\n    return section.id === \"report-source-summary\";\n  });\n  const tenthManSection = beforeSession.sections.find((section) => {\n    return section.id === \"report-tenth-man-traces\";\n  });\n\n  assert.ok(sourceSection);\n  assert.equal(sourceSection.items.length, PATTERN_ROOM_DOMAIN_TEST_FIXTURE.sources.length + 2);\n  assert.deepEqual(sourceSection.metrics, [\n    {\n      id: \"sources\",\n      label: \"kaynak\",\n      value: PATTERN_ROOM_DOMAIN_TEST_FIXTURE.sources.length + 2,\n    },\n  ]);\n  assert.doesNotMatch(\n    sourceSection.items.map((item) => item.label).join(\" \\"),\n    /Archive kaynak sayımı/\n  );\n  assert.ok(tenthManSection);\n  assert.deepEqual(tenthManSection.metrics, [\n    { id: \"references\", label: \"referans\", value: 2 },\n    { id: \"turns\", label: \"tur\", value: 0 },\n    { id: \"summary\", label: \"özet\", value: 0 },\n  ]);\n  assert.equal(\n    tenthManSection.items.filter((item) => item.id.startsWith(\"report-tenth-reference-\")).length,\n    2\n  );\n\n  localState.prepareDebate();\n  localState.assignDebateRoles();\n  localState.startDebate();\n  localState.advanceDebatePhase();\n  localState.advanceDebatePhase();\n  localState.advanceDebatePhase();\n  localState.advanceDebatePhase();\n  localState.completeDebate();\n\n  const completedSection = adaptReportViewModel(\n    PATTERN_ROOM_DOMAIN_TEST_FIXTURE,\n    localState.getOverlay()\n  ).reportSummary.sections.find((section) => {\n    return section.id === \"report-tenth-man-traces\";\n  });\n  assert.ok(completedSection);\n  assert.deepEqual(completedSection.metrics, [\n    { id: \"references\", label: \"referans\", value: 2 },\n    { id: \"turns\", label: \"tur\", value: 5 },\n    { id: \"summary\", label: \"özet\", value: 1 },\n  ]);\n});\n`;
});

await updateFile(".rovo/pattern-room-v2-progress.md", (source) => {
  if (source.includes("Completed: truthful report metrics and Tenth Man separation")) {
    return source;
  }
  const section = `## Completed: truthful report metrics and Tenth Man separation\n\n- Report source counts now represent actual domain and local source entities; aggregate summary cards are no longer counted as sources.\n- Report sections expose structured metrics instead of deriving truth from rendered item-card length.\n- Tenth Man references, local session turns and the optional session summary are counted and rendered separately.\n- Tenth Man references appear as explicit report entries even before a local debate session starts.\n- Report outline and document headers use the same structured metrics.\n\n`;
  const marker = "## Next implementation steps";
  return source.includes(marker)
    ? source.replace(marker, `${section}${marker}`)
    : `${source.trimEnd()}\n\n${section}`;
});

if (changedFiles.length === 0) {
  console.log("Pattern Room truthful report metrics are already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
