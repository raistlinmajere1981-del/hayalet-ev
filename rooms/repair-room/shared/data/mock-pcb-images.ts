import type { RepairPcbImageRef } from "../types/index.js";

export const MOCK_REPAIR_PCB_IMAGES: Record<string, RepairPcbImageRef> = {
  "psu-2025-0510": {
    id: "psu-2025-0510-pcb",
    label: "ATX PSU main board (top side)",
    src: "shared/assets/mock-pcb/atx-psu-top.svg",
    pixelsPerMm: 8,
    widthPx: 1280,
    heightPx: 720,
  },
  "lg-oled-main": {
    id: "lg-oled-main-pcb",
    label: "LG OLED main board",
    src: "shared/assets/mock-pcb/lg-oled-main.svg",
    pixelsPerMm: 6,
    widthPx: 1280,
    heightPx: 720,
  },
  "xbox-series-x": {
    id: "xbox-series-x-pcb",
    label: "Xbox Series X HDMI daughter board",
    src: "shared/assets/mock-pcb/xbox-series-x-hdmi.svg",
    pixelsPerMm: 10,
    widthPx: 1280,
    heightPx: 720,
  },
  "lenovo-note": {
    id: "lenovo-note-pcb",
    label: "Lenovo laptop motherboard",
    src: "shared/assets/mock-pcb/lenovo-motherboard.svg",
    pixelsPerMm: 7,
    widthPx: 1280,
    heightPx: 720,
  },
};
