export type PatternViewId =
  | "overview"
  | "board"
  | "desk"
  | "archive"
  | "tenth-man"
  | "report";

export type PatternBoardCategoryTone = "evidence" | "analysis" | "commentary" | "uncertainty";

export type PatternClaim = {
  id: string;
  label: string;
  summary: string;
  stance: "primary" | "counter";
};

export type PatternBoardCategory = {
  id: string;
  label: string;
  tone: PatternBoardCategoryTone;
  summary: string;
  pins: string[];
};

export type PatternSource = {
  id: string;
  label: string;
  sourceTypeLabel: string;
  origin: string;
  status: "mocked";
  note: string;
};

export type PatternDummyRole = {
  id: string;
  label: string;
  note: string;
};

export type PatternReportSection = {
  id: string;
  label: string;
  tone: PatternBoardCategoryTone;
  note: string;
  bullets: string[];
};

export type PatternTenthManSession = {
  id: string;
  label: string;
  status: "dummy";
  prompt: string;
  roles: PatternDummyRole[];
};

export type PatternReportSummary = {
  id: string;
  label: string;
  status: "dummy";
  sections: PatternReportSection[];
};

export type PatternRoomMockData = {
  roomTitle: string;
  roomLabel: string;
  roomSummary: string;
  subject: string;
  boardCategories: PatternBoardCategory[];
  claims: PatternClaim[];
  sources: PatternSource[];
  tenthManSession: PatternTenthManSession;
  reportSummary: PatternReportSummary;
};
