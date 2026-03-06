import { countBracketsContextAware } from "../../../dev/structure-visualizer.js";

export function checkBracketBalance(content: string): { ok: boolean; detail?: string } {
  const result = countBracketsContextAware(content);

  if (result.balanced) {
    return { ok: true };
  }

  const details: string[] = [];
  const pairs: Array<{ open: string; close: string; name: string }> = [
    { open: "(", close: ")", name: "Parantez" },
    { open: "{", close: "}", name: "Süslü Parantez" },
    { open: "[", close: "]", name: "Köşeli Parantez" },
  ];

  for (const pair of pairs) {
    const openCount = result.open[pair.open]?.length ?? 0;
    const closeCount = result.close[pair.close]?.length ?? 0;
    if (openCount !== closeCount) {
      const diff = Math.abs(openCount - closeCount);
      const missing = openCount > closeCount ? pair.close : pair.open;
      details.push(
        `${pair.name}: ${diff} adet '${missing}' ${openCount > closeCount ? "eksik" : "fazla"}`
      );
    }
  }

  return { ok: false, detail: details.join(", ") };
}
