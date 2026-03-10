export * from "@shared/index.js";

import type { LogEntry } from "@shared/logging-core.js";

export interface LogBatchPayload {
  entries: LogEntry[];
  sessionId: string;
  batchTimestamp: string;
  processSource: "renderer" | "main";
}

export interface LogOperationResult {
  success: boolean;
  message?: string;
  entriesWritten?: number;
  hint?: {
    category: string;
    suggestion: string;
    documentationLink?: string;
    fixCommand?: string;
  } | null;
}

export interface LogWriterConfig {
  sessionDir: string;
  enableStructuredLog: boolean;
  enableConsoleLog: boolean;
  enableErrorLog: boolean;
  enablePerformanceLog: boolean;
  compressionEnabled: boolean;
  maxFileSize: number;
}

export interface LogReaderOptions {
  sessionId?: string;
  tail?: number;
  follow?: boolean;
  filter?: {
    level?: string[];
    category?: string[];
    contains?: string;
    correlationId?: string;
  };
}

export interface SessionSummary {
  sessionId: string;
  startTime: string;
  endTime?: string;
  duration?: number;

  stats: {
    totalLogs: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    errorCount: number;
    warningCount: number;
  };

  errors?: Array<{
    timestamp: string;
    category: string;
    message: string;
    count: number;
  }>;

  performance?: {
    averageLogRate: number;
    peakMemoryUsage?: number;
  };
}
