export type MatchScope = "first" | "last" | "all";
export type EOLMode = "lf" | "crlf" | "auto" | "preserve";

export interface FileEdit {
  old_text: string;
  new_text: string;
}

export interface EditFileOptions {
  file_path: string;
  edits: FileEdit[];
  dry_run?: boolean;
  ignore_whitespace?: boolean;
  all_or_nothing?: boolean;
  match_scope?: MatchScope | number[];
  normalize_eol?: EOLMode;
}

export interface EditMatchInfo {
  line: number;
  column: number;
  length: number;
}

export interface EditResult {
  index: number;
  edit: FileEdit;
  replacements: number;
  success: boolean;
  error?: string;
  matches?: EditMatchInfo[];
}

export interface ApplyEditResult extends EditResult {
  newContent?: string;
}

export interface ConflictInfo {
  editA: number;
  editB: number;
  reason: string;
}

export interface FormatOptions {
  mode: "dry-run" | "apply";
  filePath: string;
  results: EditResult[];
  diff: string;
  hasChanges: boolean;
  elapsed: number;
  lineCount: number;
  fileSize: number;
  conflicts: ConflictInfo[];
  bracketStatus: string;
  matchScope: MatchScope | number[];
  atomic: boolean;
}
