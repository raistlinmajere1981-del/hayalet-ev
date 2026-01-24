/**
 * Test Workflow Tools
 * Predefined test workflow'ları ve batch işlemler
 */

import { withConnection, sendCDPCommand } from "../utils/cdp-connection.js";
import WebSocket from "ws";

// Workflow step tipleri
interface WorkflowStep {
  action: "click" | "fill" | "wait" | "screenshot" | "navigate" | "assert" | "key";
  selector?: string;
  text?: string;
  value?: string;
  page?: string;
  timeout?: number;
  condition?: string;
  message?: string;
  name?: string;
  key?: string;
  optional?: boolean;
}

interface WorkflowResult {
  success: boolean;
  workflow: string;
  steps: { step: number; action: string; success: boolean; error?: string }[];
  duration: number;
  screenshots: string[];
}

interface EvalResult {
  result?: { value?: unknown };
}

// Helper: Element bekle
async function waitForElement(ws: WebSocket, selector: string, timeout = 10000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const result = await sendCDPCommand(ws, "Runtime.evaluate", {
        expression: `document.querySelector('${selector.replace(/'/g, "\\'")}') !== null`,
        returnByValue: true,
      }) as EvalResult;
      if (result?.result?.value === true) return true;
    } catch { /* devam */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Helper: Element tıkla
async function clickElement(ws: WebSocket, selector: string): Promise<boolean> {
  try {
    const result = await sendCDPCommand(ws, "Runtime.evaluate", {
      expression: `(() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (el) { el.click(); return true; }
        return false;
      })()`,
      returnByValue: true,
    }) as EvalResult;
    return result?.result?.value === true;
  } catch { return false; }
}

// Helper: Metne göre tıkla
async function clickByText(ws: WebSocket, text: string, tag = "*"): Promise<boolean> {
  try {
    const result = await sendCDPCommand(ws, "Runtime.evaluate", {
      expression: `(() => {
        const els = [...document.querySelectorAll('${tag}')];
        const el = els.find(e => e.textContent?.trim() === '${text.replace(/'/g, "\\'")}');
        if (el) { el.click(); return true; }
        return false;
      })()`,
      returnByValue: true,
    }) as EvalResult;
    return result?.result?.value === true;
  } catch { return false; }
}

// Helper: Input doldur
async function fillInput(ws: WebSocket, selector: string, value: string): Promise<boolean> {
  try {
    const result = await sendCDPCommand(ws, "Runtime.evaluate", {
      expression: `(() => {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (el) {
          el.value = '${value.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      })()`,
      returnByValue: true,
    }) as EvalResult;
    return result?.result?.value === true;
  } catch { return false; }
}

// Helper: Sayfa navigasyonu
async function navigateTo(ws: WebSocket, page: string): Promise<boolean> {
  try {
    await sendCDPCommand(ws, "Runtime.evaluate", {
      expression: `(() => {
        const link = document.querySelector('a[href*="${page}"], [data-page="${page}"]');
        if (link) { link.click(); return true; }
        window.location.href = '${page}.html';
        return true;
      })()`,
      returnByValue: true,
    });
    return true;
  } catch { return false; }
}

// Helper: Screenshot (sadece log, dosya kaydetmeden)
async function takeScreenshot(ws: WebSocket, name: string): Promise<string | null> {
  try {
    await sendCDPCommand(ws, "Page.captureScreenshot", { format: "png" });
    return `screenshot-${name}-${Date.now()}`;
  } catch { return null; }
}

// Helper: Koşul kontrol
async function checkCondition(ws: WebSocket, condition: string): Promise<boolean> {
  try {
    const result = await sendCDPCommand(ws, "Runtime.evaluate", {
      expression: condition,
      returnByValue: true,
    }) as EvalResult;
    return result?.result?.value === true;
  } catch { return false; }
}

// Workflow step executor
async function executeStep(ws: WebSocket, step: WorkflowStep, stepNum: number): Promise<{ success: boolean; error?: string; screenshot?: string }> {
  try {
    switch (step.action) {
      case "click":
        if (step.selector) {
          const clicked = await clickElement(ws, step.selector);
          if (!clicked && !step.optional) return { success: false, error: `Selector bulunamadı: ${step.selector}` };
        } else if (step.text) {
          const clicked = await clickByText(ws, step.text);
          if (!clicked && !step.optional) return { success: false, error: `Metin bulunamadı: ${step.text}` };
        }
        return { success: true };

      case "fill": {
        if (!step.selector || !step.value) return { success: false, error: "selector ve value gerekli" };
        const filled = await fillInput(ws, step.selector, step.value);
        if (!filled && !step.optional) return { success: false, error: `Input doldurulamadı: ${step.selector}` };
        return { success: true };
      }

      case "wait": {
        if (step.selector) {
          const found = await waitForElement(ws, step.selector, step.timeout || 10000);
          if (!found && !step.optional) return { success: false, error: `Element bekleme timeout: ${step.selector}` };
        } else if (step.timeout) {
          await new Promise((r) => setTimeout(r, step.timeout));
        }
        return { success: true };
      }

      case "screenshot": {
        const ssName = await takeScreenshot(ws, step.name || `step-${stepNum}`);
        return { success: true, screenshot: ssName || undefined };
      }

      case "navigate": {
        if (!step.page) return { success: false, error: "page gerekli" };
        await navigateTo(ws, step.page);
        await new Promise((r) => setTimeout(r, 1000));
        return { success: true };
      }

      case "assert": {
        if (!step.condition) return { success: false, error: "condition gerekli" };
        const passed = await checkCondition(ws, step.condition);
        if (!passed) return { success: false, error: step.message || `Assert failed: ${step.condition}` };
        return { success: true };
      }

      case "key":
        return { success: true }; // TODO: implement

      default:
        return { success: false, error: `Bilinmeyen action: ${step.action}` };
    }
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Predefined Workflows
const WORKFLOWS: Record<string, WorkflowStep[]> = {
  setup_asistan: [
    { action: "navigate", page: "asistan" },
    { action: "wait", selector: "#asistan-connect-btn", timeout: 5000 },
    { action: "screenshot", name: "asistan-before", optional: true },
    { action: "click", selector: "#asistan-connect-btn" },
    { action: "wait", selector: ".status-dot.connected", timeout: 15000 },
    { action: "screenshot", name: "asistan-connected", optional: true },
  ],
  setup_entrance: [
    { action: "navigate", page: "entrance" },
    { action: "wait", selector: ".slot-panel", timeout: 5000 },
    { action: "screenshot", name: "entrance-ready", optional: true },
  ],
  setup_ai1_slot: [
    { action: "navigate", page: "entrance" },
    { action: "wait", selector: "#ai1-slot", timeout: 5000 },
    { action: "click", selector: "#ai1-toggle-btn" },
    { action: "wait", timeout: 2000 },
    { action: "wait", selector: "#ai1-slot .status-dot.connected", timeout: 15000 },
    { action: "screenshot", name: "ai1-connected", optional: true },
  ],
  check_app: [
    { action: "wait", selector: "body", timeout: 3000 },
    { action: "screenshot", name: "app-state" },
    { action: "assert", condition: "document.body !== null", message: "Uygulama yüklenmedi" },
  ],
};

// Ana workflow çalıştırıcı
async function executeWorkflow(ws: WebSocket, workflowName: string, steps: WorkflowStep[]): Promise<WorkflowResult> {
  const startTime = Date.now();
  const results: WorkflowResult["steps"] = [];
  const screenshots: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = await executeStep(ws, step, i + 1);
    
    results.push({
      step: i + 1,
      action: step.action,
      success: result.success,
      error: result.error,
    });

    if (result.screenshot) screenshots.push(result.screenshot);

    if (!result.success && !step.optional) {
      return { success: false, workflow: workflowName, steps: results, duration: Date.now() - startTime, screenshots };
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return { success: true, workflow: workflowName, steps: results, duration: Date.now() - startTime, screenshots };
}

// Export: Predefined workflow çalıştır
export async function runWorkflow(workflowName: string): Promise<WorkflowResult> {
  const steps = WORKFLOWS[workflowName];
  if (!steps) {
    return { success: false, workflow: workflowName, steps: [], duration: 0, screenshots: [] };
  }
  return withConnection((ws) => executeWorkflow(ws, workflowName, steps));
}

// Export: Custom steps çalıştır
export async function runCustomSteps(steps: unknown[]): Promise<WorkflowResult> {
  return withConnection((ws) => executeWorkflow(ws, "custom", steps as WorkflowStep[]));
}

// Export: Workflow listesi
export function listWorkflows(): { name: string; stepCount: number; actions: string }[] {
  return Object.entries(WORKFLOWS).map(([name, steps]) => ({
    name,
    stepCount: steps.length,
    actions: steps.map((s) => s.action).join(" → "),
  }));
}

// MCP Tool Definitions
export const WORKFLOW_TOOL_DEFINITIONS = [
  {
    name: "hev_run_workflow",
    description: "Predefined test workflow çalıştır: setup_asistan, setup_entrance, setup_ai1_slot, check_app",
    inputSchema: {
      type: "object",
      properties: {
        workflow: { type: "string", enum: ["setup_asistan", "setup_entrance", "setup_ai1_slot", "check_app"] },
      },
      required: ["workflow"],
    },
  },
  {
    name: "hev_run_steps",
    description: "Custom workflow adımları çalıştır (click, fill, wait, screenshot, navigate, assert)",
    inputSchema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["click", "fill", "wait", "screenshot", "navigate", "assert", "key"] },
              selector: { type: "string" },
              text: { type: "string" },
              value: { type: "string" },
              page: { type: "string" },
              timeout: { type: "number" },
              condition: { type: "string" },
              message: { type: "string" },
              name: { type: "string" },
              optional: { type: "boolean" },
            },
            required: ["action"],
          },
        },
      },
      required: ["steps"],
    },
  },
  {
    name: "hev_list_workflows",
    description: "Mevcut predefined workflow'ları listele",
    inputSchema: { type: "object", properties: {} },
  },
];
