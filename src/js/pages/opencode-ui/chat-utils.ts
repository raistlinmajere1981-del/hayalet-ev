import { formatTime, t } from "./i18n.js";

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
  if (role === "assistant" && text.trim() === "" && hasFiles !== true) {
    return null;
  }
  if (chatEmpty) chatEmpty.style.display = "none";

  const msgDiv = document.createElement("div");
  msgDiv.className = "ds-message ds-message--" + role;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "ds-message__bubble";
  if (role === "assistant" && text !== "") {
    bubbleDiv.classList.add("ds-markdown");
    bubbleDiv.innerHTML = renderFn ? renderFn(text) : escapeHtml(text).replace(/\n/g, "<br>");
  } else {
    bubbleDiv.style.whiteSpace = "pre-wrap";
    bubbleDiv.style.wordBreak = "break-word";
    bubbleDiv.textContent = text;
  }

  const roleBadge = document.createElement("span");
  roleBadge.className = "ds-message__role";
  roleBadge.textContent = role === "assistant" ? "🤖" : "👤";
  bubbleDiv.prepend(roleBadge);

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
            ? String(fileEntry.name ?? fileEntry.fileName ?? fileEntry.path ?? t("chat.attachmentFallbackName"))
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
