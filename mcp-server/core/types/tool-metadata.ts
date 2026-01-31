/**
 * Enhanced Tool Metadata Types
 * 
 * Single Source of Truth için tool metadata tanımlamaları.
 * Bu tipler tüm tool definitions'da kullanılacak.
 * 
 * @version 1.0.0
 * @created 2026-01-31
 */

/**
 * Tool Category - Ana kategoriler
 */
export type ToolCategory =
  | 'core'          // Health, list tools, discovery
  | 'filesystem'    // File operations, search, history
  | 'development'   // TypeScript, ESLint, testing, refactoring
  | 'electron'      // CDP, UI interaction, screenshots
  | 'git'           // Git operations, PR management
  | 'web'           // Web search, scraping
  | 'workflow'      // Predefined test workflows
  | 'context'       // Context generation
  | 'provider';     // Provider validation and inspection

/**
 * Tool Priority - Agent için öncelik seviyesi
 */
export type ToolPriority =
  | 'critical'      // TOP 10, must-know tools (örn: hev_fs_show, hev_dev_edit_lines)
  | 'high'          // Frequently used, important (örn: hev_dev_typescript_dashboard)
  | 'medium'        // Regular usage (örn: hev_fs_backup)
  | 'low';          // Niche use cases (örn: hev_dev_diagram_generator)

/**
 * Tool Complexity - Kullanım karmaşıklığı
 */
export type ToolComplexity =
  | 'simple'        // Single purpose, minimal params (örn: hev_fs_show)
  | 'medium'        // Multiple params, some logic (örn: hev_dev_edit_lines)
  | 'complex';      // Advanced features, workflows (örn: hev_dev_safe_batch_refactor)

/**
 * Workflow Step - Tool chain'de bir adım
 */
export interface WorkflowStep {
  step: number;
  tool: string;
  purpose: string;
  mandatory?: boolean;      // Bu adım atlanabilir mi?
  condition?: string;       // Hangi durumda kullan?
  params?: Record<string, any>;  // Önerilen parametreler
}

/**
 * Tool Example - Kullanım örneği
 */
export interface ToolExample {
  title: string;
  description: string;
  code: string;             // Tool çağrısı (JSON)
  output?: string;          // Beklenen çıktı
}

/**
 * Tool Metadata - Enhanced metadata
 */
export interface ToolMetadata {
  // === Classification ===
  category: ToolCategory;
  subcategory?: string;          // Alt kategori (örn: 'typescript', 'eslint', 'basic-io')
  
  // === Priority & Complexity ===
  priority: ToolPriority;
  complexity: ToolComplexity;
  
  // === Usage Guidance ===
  useCases: string[];            // Ne zaman kullan? (örn: ["Before any edit", "Duplicate check"])
  relatedTools?: string[];       // İlgili toollar (tool chain)
  workflow?: WorkflowStep[];     // Önerilen kullanım sırası
  
  // === Examples & Documentation ===
  examples?: ToolExample[];
  agentGuidance?: string;        // AI agent'a özel notlar ve uyarılar
  
  // === Safety & Permissions ===
  requiresConfirmation?: boolean; // Kullanıcı onayı gerekli mi?
  riskLevel?: 'low' | 'medium' | 'high';  // Operasyon riski
  
  // === Maintenance ===
  deprecated?: boolean;
  deprecationMessage?: string;
  tags?: string[];               // Searchable tags
  
  // === Statistics (optional, can be auto-calculated) ===
  estimatedIterations?: number;  // Ortalama iterasyon sayısı
  usageCount?: number;           // Kullanım sıklığı (optional)
}

/**
 * Enhanced Tool Definition - Metadata içeren tool tanımı
 */
export interface EnhancedToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
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
  riskLevel: 'low' | 'medium' | 'high';
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
  workflow?: string;          // Önerilen workflow açıklaması
  relatedScenarios?: string[]; // İlgili scenario ID'leri
}
