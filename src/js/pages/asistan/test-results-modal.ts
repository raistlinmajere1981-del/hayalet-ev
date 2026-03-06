import { LogCategory } from "@shared/logging-core";
import type { ProviderTestSuite, ProviderTestResult } from "@shared/provider.js";
import { Logger } from "../../modules/logger/index.js";

function generateTestResultsHTML(results: ProviderTestSuite): string {
  const { passed, failed, skipped, warnings, totalTests, totalDuration, aborted, abortReason } =
    results;

  let html = `
      <div class="test-results-summary">
        <div class="test-stats">
          <span class="stat-item stat-pass">✅ ${passed} Passed</span>
          <span class="stat-item stat-fail">❌ ${failed} Failed</span>
          ${warnings > 0 ? `<span class="stat-item stat-warning">⚠️ ${warnings} Warnings</span>` : ""}
          ${skipped > 0 ? `<span class="stat-item stat-skip">⏭️ ${skipped} Skipped</span>` : ""}
        </div>
        <div class="test-meta">
          <span>⏱️ Duration: ${(totalDuration / 1000).toFixed(2)}s</span>
          <span>📊 Total: ${totalTests} tests</span>
        </div>
        ${aborted === true ? `<div class="test-aborted">⚠️ Aborted: ${abortReason ?? "unknown"}</div>` : ""}
      </div>
    `;

  const categories: Record<string, ProviderTestResult[]> = {};
  results.results.forEach((result) => {
    categories[result.category] ??= [];
    categories[result.category]?.push(result);
  });

  const categoryEmoji: Record<string, string> = {
    preflight: "🚀",
    dom: "📋",
    interactive: "🎮",
    scraping: "📝",
    advanced: "🔬",
  };

  const categoryNames: Record<string, string> = {
    preflight: "Pre-flight Checks",
    dom: "DOM Tests",
    interactive: "Interactive Tests",
    scraping: "Scraping Tests",
    advanced: "Advanced Tests",
  };

  for (const [category, tests] of Object.entries(categories)) {
    html += `
        <div class="test-category">
          <h3 class="category-title">${categoryEmoji[category] ?? "📦"} ${categoryNames[category] ?? category}</h3>
          <div class="test-results-list">
      `;

    tests.forEach((test) => {
      const statusEmoji: Record<string, string> = {
        pass: "✅",
        fail: "❌",
        skip: "⏭️",
        warning: "⚠️",
      };

      html += `
          <div class="test-result-item test-${test.status}">
            <div class="test-header">
              <span class="test-status">${statusEmoji[test.status] ?? "•"}</span>
              <span class="test-name">${test.name}</span>
              <span class="test-duration">${test.duration}ms</span>
            </div>
            <div class="test-message">${test.message}</div>
        `;

      if (test.details) {
        html += '<div class="test-details">';

        if (test.details.selector !== undefined && test.details.selector !== "") {
          html += `<div class="detail-item"><strong>Selector:</strong> <code>${test.details.selector}</code></div>`;
        }

        if (test.details.error !== undefined && test.details.error !== "") {
          html += `<div class="detail-item detail-error"><strong>Error:</strong> ${test.details.error}</div>`;
        }

        if (test.details.element) {
          const el = test.details.element;
          html += `<div class="detail-item"><strong>Element:</strong> ${el.tagName} (visible: ${String(el.visible)}, enabled: ${String(el.enabled)})</div>`;
          if (el.textContent !== undefined && el.textContent !== "") {
            html += `<div class="detail-item"><strong>Text:</strong> ${el.textContent.slice(0, 50)}...</div>`;
          }
        }

        html += "</div>";
      }

      html += "</div>";
    });

    html += `
          </div>
        </div>
      `;
  }

  return html;
}

export async function openTestResultsModal(results: ProviderTestSuite): Promise<void> {
  const module = await import("../../ui/modal-manager.js");
  const { ModalManager: modalManager } = module;
  const content = generateTestResultsHTML(results);

  modalManager.open({
    title: `🧪 Test Results - ${results.providerName} (${results.slot.toUpperCase()})`,
    content,
    size: "large",
    buttons: [
      {
        text: "📋 Copy JSON",
        class: "btn-ghost",
        onClick: (): void => {
          void navigator.clipboard.writeText(JSON.stringify(results, null, 2));
          Logger.info(LogCategory.ASISTAN_CORE, "Test results copied to clipboard");
        },
      },
      {
        text: "✖ Close",
        class: "btn-primary",
        onClick: (): void => {
          modalManager.close();
        },
      },
    ],
  });
}
