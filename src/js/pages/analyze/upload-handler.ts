import { getFilename } from "../../constants/index.js";
import { AppI18n } from "../../modules/i18n/index.js";

/**
 * UploadHandler - Analyze page file upload flow
 *
 * This module handles file selection and list rendering:
 * - File picker dialog
 * - Staged file management
 * - Upload list rendering
 */

export interface StagedFile {
  name: string;
  path: string;
  commandPath?: string;
  originalName?: string;
}

function analyzeUploadT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.analyze.upload.${key}`, params);
}

export function renderUploadList(
  stagedFiles: StagedFile[],
  onRemove: (name: string) => void
): void {
  const box = document.getElementById("upload-list");
  const info = document.querySelector(".files-header div");

  if (!box) return;

  box.innerHTML = "";

  if (stagedFiles.length === 0) {
    box.textContent = analyzeUploadT("empty");
    if (info) info.textContent = analyzeUploadT("empty");
    return;
  }

  if (info) info.textContent = analyzeUploadT("count", { count: stagedFiles.length });

  stagedFiles.forEach((file: StagedFile) => {
    const row = document.createElement("div");
    row.className = "upload-item";

    const name = document.createElement("span");
    name.textContent = file.name;

    const btn = document.createElement("button");
    btn.className = "upload-remove";
    btn.textContent = "×";
    btn.title = analyzeUploadT("removeTitle");
    btn.addEventListener("click", () => {
      onRemove(file.name);
    });

    row.appendChild(name);
    row.appendChild(btn);
    box.appendChild(row);
  });
}

export async function addUploadFiles(currentFiles: StagedFile[]): Promise<StagedFile[]> {
  try {
    const showOpenDialog = window.electronAPI?.showOpenDialog;
    if (typeof showOpenDialog !== "function") {
      return currentFiles;
    }

    const selection = await showOpenDialog({
      properties: ["openFile", "multiSelections"],
    });

    if (selection.canceled) return currentFiles;

    const paths = selection.filePaths;
    if (paths.length === 0) return currentFiles;

    const newEntries = paths.map((p) => {
      const name = getFilename(String(p));
      return { name, path: p };
    });

    return [...currentFiles, ...newEntries];
  } catch (_err) {
    return currentFiles;
  }
}

export function removeUploadFile(currentFiles: StagedFile[], name: string): StagedFile[] {
  return currentFiles.filter((f: StagedFile) => f.name !== name);
}
