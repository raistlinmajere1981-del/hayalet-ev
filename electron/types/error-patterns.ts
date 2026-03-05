/**
 * Error Pattern Type Definitions
 *
 * Hata pattern veritabanı ve eşleştirme sonuçları için tip tanımları.
 *
 * @module electron/types/error-patterns
 */

export interface ErrorHint {
  pattern: string;
  category: string;
  suggestion: string;
  checkFiles: string[];
  relatedDocs: string[];
  severity?: "low" | "medium" | "high" | "critical";
}

export interface MatchedHint {
  pattern: string;
  category: string;
  suggestion: string;
  checkFiles: string[];
  relatedDocs: string[];
  severity: "low" | "medium" | "high" | "critical";
}
