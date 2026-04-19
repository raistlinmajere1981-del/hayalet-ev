import { formatTime, t } from "./i18n.js";
import { buildAssistantInteractionRenderPlan } from "./interaction-renderer.js";

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function addMessage(
  role: string,
  text: string,
  extra?: string,
  files?: Array<string | { name?: string; fileName?: string; path?: string }>,
  renderFn?: (text: string) => string
): HTMLElement | null {
  const chatMessages = document.getElementById("chat-messages") as HTMLElement;
  const chatEmpty = document.getElementById("chat-empty");
  const hasFiles = Array.isArray(files) && files.length > 0;
  const interactionPlan = role === "assistant" ? buildAssistantInteractionRenderPlan(text) : null;
  const visibleText = interactionPlan?.displayText ?? text;

  if (
    role === "assistant" &&
    visibleText.trim() === "" &&
    hasFiles !== true &&
    interactionPlan?.renderInto === undefined
  ) {
    return null;
  }
  if (chatEmpty) chatEmpty.classList.add("is-hidden");

  const msgDiv = document.createElement("div");
  msgDiv.className = "ds-message ds-message--" + role;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "ds-message__bubble";
  const contentDiv = document.createElement("div");
  contentDiv.className = "ds-message__content";

  if (role === "assistant" && interactionPlan?.renderInto !== undefined) {
    bubbleDiv.classList.add("ds-message__bubble--interactive");
    interactionPlan.renderInto(contentDiv);
  } else if (role === "assistant" && visibleText !== "") {
    bubbleDiv.classList.add("ds-markdown");
    contentDiv.innerHTML = renderFn
      ? renderFn(visibleText)
      : escapeHtml(visibleText).replace(/\n/g, "<br>");
  } else {
    bubbleDiv.classList.add("ds-message__bubble--plain");
    contentDiv.textContent = visibleText;
  }

  const roleBadge = document.createElement("span");
  roleBadge.className = "ds-message__role";
  roleBadge.textContent = role === "assistant" ? "🤖" : "👤";
  bubbleDiv.append(roleBadge, contentDiv);

  if (files && files.length > 0) {
    const chipContainer = document.createElement("div");
    chipContainer.className = "ds-file-chips";
    for (let f = 0; f < files.length; f++) {
      const chip = document.createElement("span");
      chip.className = "ds-file-chip";
      const fileEntry = files[f];
      const fileName =
        typeof fileEntry === "string"
          ? fileEntry
          : typeof fileEntry === "object"
            ? String(
                fileEntry.name ??
                  fileEntry.fileName ??
                  fileEntry.path ??
                  t("chat.attachmentFallbackName")
              )
            : t("chat.attachmentFallbackName");
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      let icon = "FILE";
      if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].indexOf(ext) !== -1) {
        icon = "IMG";
      } else if (["pdf"].indexOf(ext) !== -1) {
        icon = "PDF";
      } else if (["zip", "tar", "gz", "rar", "7z"].indexOf(ext) !== -1) {
        icon = "ARC";
      } else if (["js", "ts", "py", "css", "html", "json", "md", "sh"].indexOf(ext) !== -1) {
        icon = "CODE";
      }
      chip.textContent = icon + " " + fileName;
      chipContainer.appendChild(chip);
    }
    bubbleDiv.appendChild(chipContainer);
  }

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "ds-msg-copy";
  copyBtn.textContent = "📋";
  copyBtn.title = t("chat.copyMessageTitle");
  copyBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    const clone = bubbleDiv.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".ds-msg-copy, .ds-message__role").forEach(function (el) {
      el.remove();
    });
    const copyText = clone.innerText.trim();
    if (copyText === "") return;
    void navigator.clipboard.writeText(copyText).then(function () {
      copyBtn.textContent = "✅";
      setTimeout(function () {
        copyBtn.textContent = "📋";
      }, 1500);
    });
  });
  bubbleDiv.appendChild(copyBtn);

  const now = new Date();
  const stamp = formatTime(now);
  const timeDiv = document.createElement("div");
  timeDiv.className = "ds-message__meta";
  timeDiv.title = extra != null && extra !== "" ? stamp + " · " + extra : stamp;
  timeDiv.textContent = extra ?? "";

  msgDiv.appendChild(bubbleDiv);
  msgDiv.appendChild(timeDiv);
  chatMessages.appendChild(msgDiv);
  return bubbleDiv;
}
