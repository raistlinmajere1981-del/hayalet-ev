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

function fallbackCopy(documentRef: Document, text: string) {
  const textarea = documentRef.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  documentRef.body.appendChild(textarea);
  textarea.select();
  const copied = documentRef.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}

async function copyText(deps: LaboratoryVisualReportActionsDeps, text: string) {
  if (deps.windowRef.navigator.clipboard?.writeText !== undefined) {
    await deps.windowRef.navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopy(deps.documentRef, text);
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
  const url = deps.windowRef.URL.createObjectURL(blob);
  const anchor = deps.documentRef.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  deps.documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  deps.windowRef.setTimeout(function () {
    deps.windowRef.URL.revokeObjectURL(url);
  }, 0);
}

function showFeedback(windowRef: Window, button: HTMLElement, success: boolean) {
  const idleLabel = button.dataset["labReportIdleLabel"] ?? button.textContent ?? "";
  const label = success
    ? button.dataset["labReportSuccessLabel"] ?? idleLabel
    : button.dataset["labReportErrorLabel"] ?? "Failed";
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
