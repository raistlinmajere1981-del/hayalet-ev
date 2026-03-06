import type { ConflictInfo, FileEdit } from "./types.js";

export function detectConflicts(content: string, edits: FileEdit[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  for (let i = 0; i < edits.length; i++) {
    const editA = edits[i];
    if (!editA) continue;

    for (let j = i + 1; j < edits.length; j++) {
      const editB = edits[j];
      if (!editB) continue;

      if (editA.old_text === editB.old_text) {
        conflicts.push({
          editA: i,
          editB: j,
          reason: `Aynı old_text hedeflenmiş: "${editA.old_text.slice(0, 40)}${editA.old_text.length > 40 ? "..." : ""}"`,
        });
        continue;
      }

      if (editA.old_text.includes(editB.old_text)) {
        conflicts.push({
          editA: i,
          editB: j,
          reason: `Edit ${j + 1}'in old_text'i Edit ${i + 1}'in old_text'inin alt kümesi`,
        });
        continue;
      }

      if (editB.old_text.includes(editA.old_text)) {
        conflicts.push({
          editA: i,
          editB: j,
          reason: `Edit ${i + 1}'in old_text'i Edit ${j + 1}'in old_text'inin alt kümesi`,
        });
        continue;
      }

      const positionsA = findAllPositions(content, editA.old_text);
      const positionsB = findAllPositions(content, editB.old_text);

      for (const posA of positionsA) {
        for (const posB of positionsB) {
          const endA = posA + editA.old_text.length;
          const endB = posB + editB.old_text.length;
          if (posA < endB && posB < endA) {
            conflicts.push({
              editA: i,
              editB: j,
              reason: `Çakışan aralıklar: Edit ${i + 1} [${posA}:${endA}] vs Edit ${j + 1} [${posB}:${endB}]`,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

export function findAllPositions(content: string, search: string): number[] {
  const positions: number[] = [];
  let idx = content.indexOf(search);
  while (idx !== -1) {
    positions.push(idx);
    idx = content.indexOf(search, idx + 1);
  }
  return positions;
}
