import { describe, expect, it } from "vitest";
import {
  TESTER_BUG_REPORT_FIELDS,
  getBetaRecoveryGuidance,
} from "@/lib/beta-support";

describe("beta support guidance", () => {
  it("returns queue guidance with a simple recovery path", () => {
    const guidance = getBetaRecoveryGuidance("queue");

    expect(guidance.title).toBe("If queueing looks stuck");
    expect(guidance.steps).toEqual(
      expect.arrayContaining([
        "Refresh the page once.",
        "If you are still stuck, leave and rejoin the queue once.",
      ]),
    );
  });

  it("returns voice guidance with one retry path and one escalation path", () => {
    const guidance = getBetaRecoveryGuidance("voice");

    expect(guidance.title).toBe("If voice stops working");
    expect(guidance.steps[0]).toBe("Use Retry voice once.");
    expect(guidance.steps[2]).toContain("Send the founder");
  });

  it("keeps the founder issue intake fields concise and consistent", () => {
    expect(TESTER_BUG_REPORT_FIELDS).toEqual([
      "anonymous handle",
      "approximate time",
      "screen where it happened",
      "what you expected",
      "what actually happened",
      "whether refreshing once fixed it",
    ]);
  });
});
