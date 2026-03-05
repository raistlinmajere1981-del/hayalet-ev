import { getFilename } from "../../constants/index.js";

/**
 * UploadHandler - Analyze sayfası dosya yükleme işlemleri
 *
 * Bu modül dosya seçme ve listeleme işlemlerini yönetir:
 * - Dosya seçim dialog'u
 * - Staged files yönetimi
 * - Upload list render
 */

export interface StagedFile {
  name: string;
  path: string;
  commandPath?: string;
  originalName?: string;
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
    box.textContent = "Henüz dosya yok.";
    if (info) info.textContent = "Henüz dosya yok.";
    return;
  }

  if (info) info.textContent = `${stagedFiles.length} dosya eklendi.`;

  stagedFiles.forEach((file: StagedFile) => {
    const row = document.createElement("div");
    row.className = "upload-item";

    const name = document.createElement("span");
    name.textContent = file.name;

    const btn = document.createElement("button");
    btn.className = "upload-remove";
    btn.textContent = "×";
    btn.title = "Kaldır";
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
