import type { Id } from "../../spatial/world.ts";

export interface VirtualReading {
  state: "online" | "offline";
  value: number;
  at: number;
}

export function virtualReadings() {
  let current = new Map<Id, VirtualReading>();
  let listener: ((readings: ReadonlyMap<Id, VirtualReading>) => void) | undefined;
  return {
    subscribe(next: (readings: ReadonlyMap<Id, VirtualReading>) => void) {
      listener = next;
      next(current);
      return () => {
        if (listener === next) listener = undefined;
      };
    },
    update(id: Id, reading: VirtualReading) {
      current = new Map(current).set(id, reading);
      listener?.(current);
    },
  };
}
