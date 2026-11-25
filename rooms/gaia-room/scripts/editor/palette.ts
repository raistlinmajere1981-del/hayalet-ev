export const planWall = 0x444444;
export const selectedPlan = 0xdc8c21;
export const selectedOrbit = 0xf7ae45;

export function cssColor(value: number): string {
  return "#" + value.toString(16).padStart(6, "0");
}
