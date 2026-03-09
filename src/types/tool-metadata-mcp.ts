/**
 * Enhanced Tool Metadata Types
 *
 * Tool metadata definitions for the Single Source of Truth model.
 * These types are shared across all tool definitions.
 *
 * @version 1.0.0
 * @created 2026-01-31
 */

/**
 * Tool Category - primary categories
 */
export type ToolCategory =
  | "core" // Health, list tools, discovery
  | "filesystem" // File operations, search, history
  | "development" // TypeScript, ESLint, testing, refactoring
  | "electron" // CDP, UI interaction, screenshots
  | "debug" // Logging, error analysis, debugging
  | "git" // Git operations, PR management
  | "web" // Web search, scraping
  | "workflow" // Predefined test workflows
  | "context" // Context generation
  | "memory" // Memory/knowledge tools
  | "provider" // Provider validation and inspection
  | "ui"; // UI/Display tools (message boxes, formatting)

/**
 * Tool Priority - priority level for the agent
 */
export type ToolPriority =
  | "critical" // TOP 10, must-know tools (for example: hev_fs_show, hev_dev_edit_lines)
  | "high" // Frequently used, important (for example: hev_dev_typescript_dashboard)
  | "medium" // Regular usage (for example: hev_fs_backup)
  | "low"; // Niche use cases (for example: hev_dev_diagram_generator)

/**
 * Tool Complexity - usage complexity
 */
export type ToolComplexity =
  | "simple" // Single purpose, minimal params (for example: hev_fs_show)
  | "medium" // Multiple params, some logic (for example: hev_dev_edit_lines)
  | "complex"; // Advanced features, workflows (for example: hev_dev_safe_batch_refactor)

/**
 * Workflow Step - one step in a tool chain
 */
export interface WorkflowStep {
  step: number;
  tool: string;
  purpose: string;
  mandatory?: boolean; // Can this step be skipped?
  condition?: string; // When should it be used?
  params?: Record<string, unknown>; // Suggested parameters
}

/**
 * Tool Example - usage example
 */
export interface ToolExample {
  title: string;
  description: string;
  code: string; // Tool call (JSON)
  output?: string; // Expected output
}

/**
 * Tool Metadata - Enhanced metadata
 */
export interface ToolMetadata {
  // === Classification ===
  category: ToolCategory;
  subcategory?: string; // Subcategory (for example: 'typescript', 'eslint', 'basic-io')

  // === Priority & Complexity ===
  priority: ToolPriority;
  complexity: ToolComplexity;

  // === Usage Guidance ===
  useCases: string[]; // When should it be used? (for example: ["Before any edit", "Duplicate check"])
  relatedTools?: string[]; // Related tools (tool chain)
  workflow?: WorkflowStep[]; // Suggested execution order

  // === Examples & Documentation ===
  examples?: ToolExample[];
  agentGuidance?: string; // Notes and warnings for AI agents

  // === Safety & Permissions ===
  requiresConfirmation?: boolean; // Is user confirmation required?
  riskLevel?: "low" | "medium" | "high"; // Operational risk

  // === Maintenance ===
  deprecated?: boolean;
  deprecationMessage?: string;
  tags?: string[]; // Searchable tags

  // === Statistics (optional, can be auto-calculated) ===
  estimatedIterations?: number; // Average iteration count
  usageCount?: number; // Usage frequency (optional)
}

/**
 * Enhanced Tool Definition - tool definition with metadata
 */
export interface EnhancedToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  metadata: ToolMetadata;
}

/**
 * Workflow Scenario - Predefined scenario with tool sequence
 */
export interface WorkflowScenario {
  id: string;
  name: string;
  description: string;
  tools: WorkflowStep[];
  estimatedIterations: number;
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  tags: string[];
}

/**
 * Tool Discovery Result
 */
export interface ToolDiscoveryResult {
  recommended: Array<{
    tool: string;
    priority: number;
    reason: string;
    metadata?: ToolMetadata;
  }>;
  workflow?: string; // Suggested workflow description
  relatedScenarios?: string[]; // Related scenario IDs
}
