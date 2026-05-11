import type { RepairChatTurn } from "../types/index.js";

export const MOCK_REPAIR_CHAT_TURNS: RepairChatTurn[] = [
  {
    id: "chat-psu-001",
    role: "ai",
    text:
      "Based on BN44-00932A known issues, the primary side startup circuit is the most common failure point. Let's begin with these checks:\n  1. Measure bulk capacitor (C101) voltage\n  2. Check startup resistor (R201)\n  3. Verify U14 (PWM Controller) VCC pin",
    occurredAt: "2026-05-10T10:31:00.000Z",
    contextRefs: ["bn44-00932a", "evt-psu-ai-1"],
  },
  {
    id: "chat-psu-002",
    role: "operator",
    text: "C101 voltage is 0 V. Board is completely dead. What should we check next?",
    occurredAt: "2026-05-10T10:33:21.000Z",
    contextRefs: ["evt-psu-meas-1"],
  },
  {
    id: "chat-psu-003",
    role: "ai",
    text:
      "With C101 at 0 V on a dead board the standby loop never started. Verify the line side first — confirm BULK_DC (the bulk-cap +) reads ~380 V with the unit plugged in (use isolation transformer). If BULK_DC is also 0 V, the rectifier or NTC inrush resistor is suspect; if BULK_DC is healthy, the startup loop (R201 + U14 VCC) is the next stop.",
    occurredAt: "2026-05-10T10:33:48.000Z",
    contextRefs: ["evt-psu-meas-1", "bn44-00932a"],
  },
  {
    id: "chat-psu-004",
    role: "operator",
    text: "R201 measures OL. Replacing with 220k 1W flameproof. Anything else to verify before reflow?",
    occurredAt: "2026-05-10T10:36:02.000Z",
    contextRefs: ["evt-psu-meas-2"],
  },
];
