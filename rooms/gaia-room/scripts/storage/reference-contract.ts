import type { Calibration, Id } from "../spatial/world.ts";

export const imageMimes = ["image/png", "image/jpeg", "image/bmp"] as const;
export const maxImageBytes = 32 * 1024 * 1024;
export const maxImagePixels = 32_000_000;
export const maxImagePayload = Math.ceil(maxImageBytes / 3) * 4;

export interface ReferencePreview {
  mime: string;
  image: string;
}

export type ReferenceEdit =
  | { op: "import"; id: Id; asset: Id; name: string; image: string; frame: Id | null }
  | { op: "replace"; id: Id; asset: Id; name: string; image: string }
  | {
      op: "appearance";
      id: Id;
      frame: Id | null;
      visible: boolean;
      locked: boolean;
      opacity: number;
    }
  | { op: "calibrate"; id: Id; calibration: Calibration }
  | { op: "remove"; id: Id };

export interface ReferenceBatch {
  scope: "reference";
  project: Id;
  session: string;
  operationId: string;
  baseRevision: number;
  edit: ReferenceEdit;
}
