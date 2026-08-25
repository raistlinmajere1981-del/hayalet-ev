type LaboratoryVisualReportActionsDeps = {
  documentRef: Document;
  windowRef: Window;
};

function getReportText(trigger: Element) {
  const report = trigger.closest<HTMLElement>("[data-lab-exportable-report='true']");
  const source = report?.querySelector<HTMLTextAreaElement>("[data-lab-report-markdown='true']");
  const text = source?.value.trim() ?? "";
  return text === "" ? null : { report, text };
}

async function copyText(deps: LaboratoryVisualReportActionsDeps, text: string) {
  await deps.windowRef.navigator.clipboard.writeText(text);
}

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return cleaned === "" ? "laboratory-visual-report.md" : `${cleaned}.md`;
}

function exportMarkdown(
  deps: LaboratoryVisualReportActionsDeps,
  trigger: HTMLElement,
  text: string
) {
  const report = trigger.closest<HTMLElement>("[data-lab-exportable-report='true']");
  const filename = safeFileName(report?.dataset["labReportFilename"] ?? "laboratory-visual-report");
  const blob = new Blob([text, "\n"], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = deps.documentRef.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  deps.documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  deps.windowRef.setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 0);
}

function showFeedback(windowRef: Window, button: HTMLElement, success: boolean) {
  const idleLabel = button.getAttribute("data-lab-report-idle-label") || button.textContent || "";
  const label = success
    ? button.getAttribute("data-lab-report-success-label") || idleLabel
    : button.getAttribute("data-lab-report-error-label") || "Failed";
  button.textContent = label;
  button.dataset["labReportActionState"] = success ? "success" : "error";
  button.setAttribute("disabled", "");
  windowRef.setTimeout(function () {
    button.textContent = idleLabel;
    delete button.dataset["labReportActionState"];
    button.removeAttribute("disabled");
  }, 1400);
}

export function bindLaboratoryVisualReportActions(deps: LaboratoryVisualReportActionsDeps) {
  function handleClick(event: Event) {
    if (!(event.target instanceof Element)) {
      return;
    }
    const trigger = event.target.closest<HTMLElement>(
      "[data-lab-report-copy='true'], [data-lab-report-export='true']"
    );
    if (trigger === null) {
      return;
    }
    const report = getReportText(trigger);
    if (report === null) {
      return;
    }
    event.preventDefault();

    if (trigger.dataset["labReportExport"] === "true") {
      try {
        exportMarkdown(deps, trigger, report.text);
        showFeedback(deps.windowRef, trigger, true);
      } catch {
        showFeedback(deps.windowRef, trigger, false);
      }
      return;
    }

    void copyText(deps, report.text)
      .then(function () {
        showFeedback(deps.windowRef, trigger, true);
      })
      .catch(function () {
        showFeedback(deps.windowRef, trigger, false);
      });
  }

  deps.documentRef.addEventListener("click", handleClick);
  return function detachLaboratoryVisualReportActions() {
    deps.documentRef.removeEventListener("click", handleClick);
  };
}
