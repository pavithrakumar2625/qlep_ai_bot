import { describe, expect, it } from "vitest";
import { mockFeedbackItems } from "@qelp/shared/contracts";
import { aiTriager } from "./aiTriager.js";

describe("aiTriager", () => {
  it("returns structured analysis for feedback", async () => {
    const analysis = await aiTriager.analyze(mockFeedbackItems[0]);
    expect(analysis.title.length).toBeGreaterThan(3);
    expect(analysis.summary).toContain("Customer-reported issue");
    expect(analysis.priorityScore.label).toMatch(/low|medium|high|urgent/);
    expect(analysis.emotion.primary).toMatch(/positive|neutral|negative/);
  });
});
