export type PatternWorkspaceTextKey =
  | "shell.kicker"
  | "shell.title"
  | "shell.status"
  | "shell.navigationLabel"
  | "shell.caseLabel"
  | "shell.sourceMetric"
  | "shell.pinMetric"
  | "shell.reviewMetric"
  | "shell.keyboardHint"
  | "nav.overview.label"
  | "nav.overview.description"
  | "nav.board.label"
  | "nav.board.description"
  | "nav.archive.label"
  | "nav.archive.description"
  | "nav.connections.label"
  | "nav.connections.description"
  | "nav.review.label"
  | "nav.review.description"
  | "nav.report.label"
  | "nav.report.description"
  | "nav.reviewHistory.label"
  | "nav.reviewHistory.description"
  | "overview.activityLabel"
  | "overview.activityTitle"
  | "overview.activityCopy"
  | "board.canvasLabel"
  | "board.inspectorLabel"
  | "board.toolsLabel"
  | "archive.browserLabel"
  | "archive.inspectorLabel"
  | "archive.toolsLabel"
  | "archive.searchLabel"
  | "archive.searchPlaceholder"
  | "archive.filterLabel"
  | "archive.allSources"
  | "archive.visibleCount"
  | "archive.empty"
  | "connections.kicker"
  | "connections.title"
  | "connections.intro"
  | "connections.entitiesLabel"
  | "connections.composerLabel"
  | "report.outlineLabel"
  | "report.documentLabel"
  | "report.jumpLabel"
  | "review.workspaceLabel"
  | "review.debateInspectorLabel";

export type PatternWorkspaceTranslator = (
  key: PatternWorkspaceTextKey,
  replacements?: Readonly<Record<string, string>>
) => string;

const FALLBACK_TR: Readonly<Record<PatternWorkspaceTextKey, string>> = {
  "shell.kicker": "Soruşturma sistemi",
  "shell.title": "Pattern Room",
  "shell.status": "Yerel vaka aktif",
  "shell.navigationLabel": "Çalışma alanları",
  "shell.caseLabel": "Aktif vaka",
  "shell.sourceMetric": "%count% kaynak",
  "shell.pinMetric": "%count% iz",
  "shell.reviewMetric": "%count% inceleme",
  "shell.keyboardHint": "Ok tuşlarıyla çalışma alanları arasında geçiş yap.",
  "nav.overview.label": "Vaka Merkezi",
  "nav.overview.description": "Genel görünüm",
  "nav.board.label": "Dedektif Panosu",
  "nav.board.description": "İzler ve notlar",
  "nav.archive.label": "Arşiv",
  "nav.archive.description": "Kaynak araştırması",
  "nav.connections.label": "Bağlantılar",
  "nav.connections.description": "İlişki haritası",
  "nav.review.label": "Vaka İncelemesi",
  "nav.review.description": "10. Adam ve AI",
  "nav.report.label": "Rapor",
  "nav.report.description": "Salt okunur dosya",
  "nav.reviewHistory.label": "İnceleme Geçmişi",
  "nav.reviewHistory.description": "Önceki oturumlar",
  "overview.activityLabel": "Vaka faaliyeti",
  "overview.activityTitle": "Araştırma masası hazır",
  "overview.activityCopy": "Her ana araç soldaki navigasyondan doğrudan açılır.",
  "board.canvasLabel": "Pano çalışma yüzeyi",
  "board.inspectorLabel": "Pano inspector",
  "board.toolsLabel": "Hızlı ekleme araçları",
  "archive.browserLabel": "Kaynak tarayıcı",
  "archive.inspectorLabel": "Kaynak inspector",
  "archive.toolsLabel": "Arşiv araçları",
  "archive.searchLabel": "Arşivde ara",
  "archive.searchPlaceholder": "Başlık, tür, köken veya içerik ara",
  "archive.filterLabel": "Kaynak türü",
  "archive.allSources": "Tüm kaynaklar",
  "archive.visibleCount": "%visible% / %total% kaynak",
  "archive.empty": "Bu aramayla eşleşen kaynak yok.",
  "connections.kicker": "İlişki haritası",
  "connections.title": "Bağlantılar",
  "connections.intro": "İddiaları, kaynakları ve kanıtları aynı ilişki yüzeyinde karşılaştır.",
  "connections.entitiesLabel": "Bağlanabilir öğeler",
  "connections.composerLabel": "Yeni bağlantı",
  "report.outlineLabel": "Belge içeriği",
  "report.documentLabel": "Vaka raporu",
  "report.jumpLabel": "%section% bölümüne git",
  "review.workspaceLabel": "Vaka inceleme çalışma alanı",
  "review.debateInspectorLabel": "10. Adam oturumu",
};

const FALLBACK_EN: Readonly<Record<PatternWorkspaceTextKey, string>> = {
  "shell.kicker": "Investigation system",
  "shell.title": "Pattern Room",
  "shell.status": "Local case active",
  "shell.navigationLabel": "Workspaces",
  "shell.caseLabel": "Active case",
  "shell.sourceMetric": "%count% sources",
  "shell.pinMetric": "%count% leads",
  "shell.reviewMetric": "%count% reviews",
  "shell.keyboardHint": "Use the arrow keys to move between workspaces.",
  "nav.overview.label": "Case Hub",
  "nav.overview.description": "Case overview",
  "nav.board.label": "Detective Board",
  "nav.board.description": "Leads and notes",
  "nav.archive.label": "Archive",
  "nav.archive.description": "Source research",
  "nav.connections.label": "Connections",
  "nav.connections.description": "Relationship map",
  "nav.review.label": "Case Review",
  "nav.review.description": "Tenth Man and AI",
  "nav.report.label": "Report",
  "nav.report.description": "Read-only brief",
  "nav.reviewHistory.label": "Review History",
  "nav.reviewHistory.description": "Previous sessions",
  "overview.activityLabel": "Case activity",
  "overview.activityTitle": "Investigation desk ready",
  "overview.activityCopy": "Open every major tool directly from the navigation.",
  "board.canvasLabel": "Board workspace",
  "board.inspectorLabel": "Board inspector",
  "board.toolsLabel": "Quick authoring tools",
  "archive.browserLabel": "Source browser",
  "archive.inspectorLabel": "Source inspector",
  "archive.toolsLabel": "Archive tools",
  "archive.searchLabel": "Search archive",
  "archive.searchPlaceholder": "Search title, type, origin, or content",
  "archive.filterLabel": "Source type",
  "archive.allSources": "All sources",
  "archive.visibleCount": "%visible% / %total% sources",
  "archive.empty": "No sources match this search.",
  "connections.kicker": "Relationship map",
  "connections.title": "Connections",
  "connections.intro": "Compare claims, sources, and evidence on one relationship surface.",
  "connections.entitiesLabel": "Connectable items",
  "connections.composerLabel": "New connection",
  "report.outlineLabel": "Document outline",
  "report.documentLabel": "Case report",
  "report.jumpLabel": "Jump to %section%",
  "review.workspaceLabel": "Case review workspace",
  "review.debateInspectorLabel": "Tenth Man session",
};

function readNestedText(value: unknown, path: readonly string[]): string | null {
  let current = value;
  for (const segment of path) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" && current.trim() !== "" ? current : null;
}

export function createPatternWorkspaceTranslator(
  locale: string,
  translations: unknown
): PatternWorkspaceTranslator {
  const fallback = locale.toLocaleLowerCase().startsWith("tr") ? FALLBACK_TR : FALLBACK_EN;

  return (key, replacements = {}): string => {
    const catalogText = readNestedText(translations, ["workspace", ...key.split(".")]);
    let value = catalogText ?? fallback[key];
    for (const [name, replacement] of Object.entries(replacements)) {
      value = value.replaceAll(`%${name}%`, replacement);
    }
    return value;
  };
}
