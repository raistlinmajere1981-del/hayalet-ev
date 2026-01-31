/**
 * Workflow Registry
 * 
 * Predefined scenarios with tool sequences for common tasks.
 * Provides step-by-step guidance for complex operations.
 * 
 * @version 1.0.0
 * @created 2026-01-31
 */

import type { WorkflowScenario, WorkflowStep } from '../types/index.js';

/**
 * Common workflow scenarios
 * Each scenario includes:
 * - Tool sequence with purposes
 * - Estimated iterations
 * - Risk level
 * - Confirmation requirements
 */
export const WORKFLOW_SCENARIOS: Record<string, WorkflowScenario> = {
  
  // === TypeScript Workflows ===
  'typescript-fix-large': {
    id: 'typescript-fix-large',
    name: 'TypeScript Hatalarını Toplu Düzelt (100+ hata)',
    description: 'Yüzlerce TypeScript hatasını sistematik olarak düzelt. Dashboard → Analiz → Batch fix → Verify',
    tools: [
      {
        step: 1,
        tool: 'hev_dev_typescript_dashboard',
        purpose: 'Baseline & error distribution analizi',
        mandatory: true
      },
      {
        step: 2,
        tool: 'hev_dev_safe_batch_refactor',
        purpose: 'Top error code\'u toplu düzelt',
        condition: 'Benzer hatalar varsa (50+)',
        params: {
          verify_after_each: true,
          auto_rollback_on_error: true
        }
      },
      {
        step: 3,
        tool: 'hev_dev_fix_typescript_batch',
        purpose: 'Undefined checks otomatik ekle',
        condition: 'TS2722/TS2532 hataları varsa',
        params: {
          error_codes: ['TS2722', 'TS2532'],
          dry_run: false
        }
      },
      {
        step: 4,
        tool: 'hev_dev_typescript_dashboard',
        purpose: 'Progress check & next error code',
        mandatory: true
      },
      {
        step: 5,
        tool: 'hev_dev_typescript_type_helper',
        purpose: 'Manuel fix gereken type conflict\'ler',
        condition: 'Karmaşık type hatası varsa'
      }
    ],
    estimatedIterations: 30,
    riskLevel: 'medium',
    requiresConfirmation: true,
    tags: ['typescript', 'batch-fix', 'refactoring']
  },

  'typescript-fix-small': {
    id: 'typescript-fix-small',
    name: 'TypeScript Hatalarını Manuel Düzelt (10-50 hata)',
    description: 'Az sayıda TypeScript hatasını manuel olarak düzelt',
    tools: [
      {
        step: 1,
        tool: 'hev_dev_typescript_dashboard',
        purpose: 'Hata listesi & priority',
        mandatory: true
      },
      {
        step: 2,
        tool: 'hev_fs_show',
        purpose: 'Hatalı dosyayı incele',
        mandatory: true
      },
      {
        step: 3,
        tool: 'hev_dev_edit_lines',
        purpose: 'Manuel fix',
        params: { safe_mode: true }
      },
      {
        step: 4,
        tool: 'hev_dev_check_syntax',
        purpose: 'Syntax doğrulama',
        mandatory: true
      },
      {
        step: 5,
        tool: 'hev_dev_typescript_dashboard',
        purpose: 'Verify fix',
        mandatory: true
      }
    ],
    estimatedIterations: 15,
    riskLevel: 'low',
    requiresConfirmation: false,
    tags: ['typescript', 'manual-fix']
  },

  // === File Editing Workflows ===
  'file-edit-safe': {
    id: 'file-edit-safe',
    name: 'Güvenli Dosya Düzenleme',
    description: 'Standart dosya düzenleme workflow\'u. ALWAYS follow this.',
    tools: [
      {
        step: 1,
        tool: 'hev_fs_show',
        purpose: 'İçerik kontrolü & line numbers',
        mandatory: true
      },
      {
        step: 2,
        tool: 'hev_dev_edit_lines',
        purpose: 'Düzenleme',
        params: { safe_mode: true },
        mandatory: true
      },
      {
        step: 3,
        tool: 'hev_dev_check_syntax',
        purpose: 'Syntax & bracket validation',
        mandatory: true
      },
      {
        step: 4,
        tool: 'hev_fs_show',
        purpose: 'Duplicate kontrolü',
        mandatory: true
      }
    ],
    estimatedIterations: 5,
    riskLevel: 'low',
    requiresConfirmation: false,
    tags: ['file-edit', 'safe', 'standard']
  },

  'batch-refactor': {
    id: 'batch-refactor',
    name: 'Toplu Refactoring (50+ değişiklik)',
    description: 'Büyük ölçekli refactoring işlemi',
    tools: [
      {
        step: 1,
        tool: 'hev_dev_analyze_project',
        purpose: 'Proje durumu & etki analizi',
        mandatory: true
      },
      {
        step: 2,
        tool: 'hev_fs_bash',
        purpose: 'Git branch oluştur',
        params: { command: 'git checkout -b refactor/batch-changes' },
        mandatory: true
      },
      {
        step: 3,
        tool: 'hev_dev_safe_batch_refactor',
        purpose: 'Batch refactoring',
        params: {
          verify_after_each: true,
          auto_rollback_on_error: true
        },
        mandatory: true
      },
      {
        step: 4,
        tool: 'hev_dev_check_syntax',
        purpose: 'Tüm dosyaları validate et',
        mandatory: true
      },
      {
        step: 5,
        tool: 'hev_dev_test_run',
        purpose: 'Test suite çalıştır',
        condition: 'Test varsa'
      }
    ],
    estimatedIterations: 25,
    riskLevel: 'high',
    requiresConfirmation: true,
    tags: ['refactoring', 'batch', 'high-risk']
  },

  // === Debugging Workflows ===
  'debug-electron': {
    id: 'debug-electron',
    name: 'Electron App Debug',
    description: 'Electron uygulamasında hata ayıklama',
    tools: [
      {
        step: 1,
        tool: 'hev_check_electron_connection',
        purpose: 'CDP bağlantısını doğrula',
        mandatory: true
      },
      {
        step: 2,
        tool: 'hev_read_electron_logs',
        purpose: 'Son logları oku',
        params: { type: 'all', tail: 100 },
        mandatory: true
      },
      {
        step: 3,
        tool: 'hev_get_error_hints',
        purpose: 'Hata pattern\'i analiz et',
        condition: 'Hata mesajı varsa'
      },
      {
        step: 4,
        tool: 'hev_take_cdp_screenshot',
        purpose: 'UI state\'i kaydet',
        condition: 'UI problemi varsa'
      },
      {
        step: 5,
        tool: 'hev_collect_error_context',
        purpose: 'Hata context\'ini topla',
        mandatory: true
      }
    ],
    estimatedIterations: 10,
    riskLevel: 'low',
    requiresConfirmation: false,
    tags: ['debug', 'electron', 'troubleshoot']
  },

  // === Git Workflows ===
  'create-pr': {
    id: 'create-pr',
    name: 'Pull Request Oluştur',
    description: 'Değişiklikleri commit et ve PR oluştur',
    tools: [
      {
        step: 1,
        tool: 'hev_dev_git_diff',
        purpose: 'Değişiklikleri gözden geçir',
        mandatory: true
      },
      {
        step: 2,
        tool: 'hev_dev_check_syntax',
        purpose: 'Tüm dosyaları validate et',
        mandatory: true
      },
      {
        step: 3,
        tool: 'hev_git_check_guidelines',
        purpose: 'Contribution guidelines kontrolü',
        condition: 'Repo guidelines varsa'
      },
      {
        step: 4,
        tool: 'hev_git_create_pr',
        purpose: 'Commit & push & PR oluştur',
        params: {
          base_branch: 'main',
          title: 'feat: ...',
          body: 'Description...'
        },
        mandatory: true
      }
    ],
    estimatedIterations: 10,
    riskLevel: 'medium',
    requiresConfirmation: true,
    tags: ['git', 'pr', 'contribution']
  },

  // === ESLint Workflows ===
  'eslint-fix-large': {
    id: 'eslint-fix-large',
    name: 'ESLint Hatalarını Toplu Düzelt',
    description: 'Yüzlerce ESLint hatasını otomatik düzelt',
    tools: [
      {
        step: 1,
        tool: 'hev_dev_eslint_dashboard',
        purpose: 'Hata dağılımı & fixable count',
        mandatory: true
      },
      {
        step: 2,
        tool: 'hev_dev_eslint_batch_fix',
        purpose: 'Fixable hataları otomatik düzelt',
        params: {
          fix_strategy: 'safe',
          dry_run: false,
          verify_after: true
        },
        mandatory: true
      },
      {
        step: 3,
        tool: 'hev_dev_eslint_dashboard',
        purpose: 'Progress check',
        mandatory: true
      }
    ],
    estimatedIterations: 15,
    riskLevel: 'medium',
    requiresConfirmation: true,
    tags: ['eslint', 'batch-fix', 'auto-fix']
  }
};

/**
 * Get workflow by ID
 */
export function getWorkflow(id: string): WorkflowScenario | undefined {
  return WORKFLOW_SCENARIOS[id];
}

/**
 * Get workflows by tag
 */
export function getWorkflowsByTag(tag: string): WorkflowScenario[] {
  return Object.values(WORKFLOW_SCENARIOS).filter(w => w.tags.includes(tag));
}

/**
 * Get all workflow IDs
 */
export function getAllWorkflowIds(): string[] {
  return Object.keys(WORKFLOW_SCENARIOS);
}

/**
 * Format workflow as human-readable guide
 */
export function formatWorkflowGuide(workflow: WorkflowScenario): string {
  let guide = `## ${workflow.name}\n\n`;
  guide += `${workflow.description}\n\n`;
  guide += `**Estimated iterations:** ${workflow.estimatedIterations}\n`;
  guide += `**Risk level:** ${workflow.riskLevel}\n`;
  guide += `**Requires confirmation:** ${workflow.requiresConfirmation ? 'Yes' : 'No'}\n\n`;
  guide += `### Steps:\n\n`;
  
  workflow.tools.forEach(step => {
    guide += `${step.step}. **${step.tool}**\n`;
    guide += `   - Purpose: ${step.purpose}\n`;
    if (step.mandatory) {
      guide += `   - ⚠️ MANDATORY\n`;
    }
    if (step.condition) {
      guide += `   - Condition: ${step.condition}\n`;
    }
    if (step.params) {
      guide += `   - Params: \`${JSON.stringify(step.params)}\`\n`;
    }
    guide += `\n`;
  });
  
  return guide;
}
