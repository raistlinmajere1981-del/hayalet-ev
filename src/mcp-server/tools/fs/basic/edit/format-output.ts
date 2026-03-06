import type { EditMatchInfo, FormatOptions } from "./types.js";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatOutput(opts: FormatOptions): string {
  const {
    mode,
    filePath,
    results,
    diff,
    hasChanges,
    elapsed,
    lineCount,
    fileSize,
    conflicts,
    bracketStatus,
    matchScope,
    atomic,
  } = opts;

  const successCount = results.filter((r) => r.success).length;
  const totalReplacements = results.reduce((sum, r) => sum + r.replacements, 0);

  const icon = mode === "dry-run" ? "🔍" : "✅";
  const modeLabel = mode === "dry-run" ? "DRY-RUN" : "Edit Tamamlandı";

  const lines: string[] = [
    `${icon} ${modeLabel}: ${filePath} (${formatFileSize(fileSize)}, ${lineCount} satır)`,
    `⏱️ ${elapsed}ms`,
    "",
    "═".repeat(60),
    `📊 ${successCount}/${results.length} edit başarılı • ${totalReplacements} replacement${atomic ? " • atomic: on" : ""}`,
    "",
  ];

  if (conflicts.length > 0) {
    lines.push(`⚠️ ${conflicts.length} conflict tespit edildi:`);
    for (const c of conflicts) {
      lines.push(`  Edit ${c.editA + 1} ↔ Edit ${c.editB + 1}: ${c.reason}`);
    }
    lines.push("");
  }

  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    const matchInfo =
      result.matches && result.matches.length > 0
        ? result.matches.map((m: EditMatchInfo) => `L${m.line}`).join(", ")
        : "";
    const scopeLabel = Array.isArray(matchScope)
      ? `indexes: [${matchScope.join(",")}]`
      : matchScope !== "all"
        ? `scope: ${matchScope}`
        : "";

    const oldText = result.edit.old_text;
    const preview = oldText.slice(0, 50).replace(/\n/g, "\\n");
    const truncated = oldText.length > 50 ? "..." : "";

    let detail = `${status} Edit ${result.index + 1}: `;
    if (result.success) {
      detail += `${result.replacements} replacement`;
      if (matchInfo !== "") detail += ` [${matchInfo}]`;
      if (scopeLabel !== "") detail += ` (${scopeLabel})`;
    } else {
      detail += result.error ?? "Bilinmeyen hata";
    }
    lines.push(detail);
    const newText = result.edit.new_text;
    const newPreview = newText.slice(0, 50).replace(/\n/g, "\\n");
    const newTruncated = newText.length > 50 ? "..." : "";
    lines.push(`   "${preview}${truncated}" → "${newPreview}${newTruncated}"`);
    lines.push("");
  }

  lines.push("─".repeat(60));
  if (mode === "dry-run") {
    lines.push("Önizleme:");
  } else {
    lines.push("Uygulanan Değişiklikler:");
  }
  lines.push(diff);
  lines.push("");

  if (bracketStatus !== "") {
    lines.push(bracketStatus);
  }

  if (mode === "dry-run") {
    lines.push(hasChanges ? "💡 Değişiklikler uygulanmadı (dry-run)" : "💡 Değişiklik yok");
    lines.push("💡 Uygulamak için dry_run=false kullanın");
  }

  if (/\.(ts|tsx)$/.test(filePath) && mode === "apply" && hasChanges) {
    lines.push("💡 TS kontrolü: hev_dev_check_syntax");
  }

  return lines.join("\n");
}
