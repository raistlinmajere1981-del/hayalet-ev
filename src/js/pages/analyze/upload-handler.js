/**
 * UploadHandler - Analyze sayfası dosya yükleme işlemleri
 * 
 * Bu modül dosya seçme ve listeleme işlemlerini yönetir:
 * - Dosya seçim dialog'u
 * - Staged files yönetimi
 * - Upload list render
 */

/**
 * Upload list'i render et
 * @param {Array} stagedFiles - Seçilen dosyalar listesi
 * @param {Function} onRemove - Dosya kaldırma callback'i
 */
export function renderUploadList(stagedFiles, onRemove) {
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
  
  stagedFiles.forEach((file) => {
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

/**
 * Dosya seçim dialog'unu aç ve dosyaları ekle
 * @param {Array} currentFiles - Mevcut staged files
 * @returns {Promise<Array>} - Güncellenmiş staged files
 */
export async function addUploadFiles(currentFiles) {
  try {
    const selection = await window.electronAPI?.showOpenDialog?.({
      properties: ["openFile", "multiSelections"],
    });
    
    if (!selection) return currentFiles;
    
    let paths = [];
    if (typeof selection === "string") {
      paths = [selection];
    } else if (Array.isArray(selection)) {
      paths = selection;
    } else if (selection && Array.isArray(selection.filePaths)) {
      paths = selection.filePaths;
    } else if (selection && typeof selection.path === "string") {
      paths = [selection.path];
    } else {
      paths = [];
    }
    
    if (!paths.length) return currentFiles;
    
    const newEntries = paths.map((p) => {
      const parts = String(p).split(/[/\\]/);
      const name = parts.pop() || "dosya";
      return { name, path: p };
    });
    
    return [...currentFiles, ...newEntries];
  } catch (_err) {
    return currentFiles;
  }
}

/**
 * Dosyayı listeden kaldır
 * @param {Array} currentFiles - Mevcut staged files
 * @param {string} name - Kaldırılacak dosya adı
 * @returns {Array} - Güncellenmiş staged files
 */
export function removeUploadFile(currentFiles, name) {
  return currentFiles.filter((f) => f.name !== name);
}
