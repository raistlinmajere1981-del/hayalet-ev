import { getFilename } from "../../constants/index.js";

/**
 * UploadHandler - Analyze sayfası dosya yükleme işlemleri
 * 
 * Bu modül dosya seçme ve listeleme işlemlerini yönetir:
 * - Dosya seçim dialog'u
 * - Staged files yönetimi
 * - Upload list render
 */

interface StagedFile {
  name: string;
  path: string;
}

export function renderUploadList(stagedFiles: StagedFile[], onRemove: (name: string) => void) {
  const box = document.getElementById("upload-list");
  const info = document.querySelector(".files-header div");
  
  if (!box) return;
  
  box.innerHTML = "";
  
  if (!stagedFiles.length) {
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
    btn.addEventListener("click", () => onRemove(file.name));
    
    row.appendChild(name);
    row.appendChild(btn);
    box.appendChild(row);
  });
}

export async function addUploadFiles(currentFiles: StagedFile[]): Promise<StagedFile[]> {
  try {
    const selection = await window.electronAPI?.showOpenDialog?.({
      properties: ["openFile", "multiSelections"],
    });
    
    // Dialog iptal edildi veya sonuç yok
    if (!selection) return currentFiles;
    if (selection.canceled) return currentFiles;
    
    const paths = selection.filePaths || [];
    if (!paths.length) return currentFiles;
    
    const newEntries = paths.map((p) => {
      const name = getFilename(String(p)) || "dosya";
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
