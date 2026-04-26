import { describe, expect, it } from "vitest";
import { getMatchingPhase, getMatchingRulesSummary, normalizeCountryFilters } from "@/server/services/matching";

describe("normalizeCountryFilters", () => {
  it("deduplicates, normalizes, and caps filters at two values", () => {
    expect(
      normalizeCountryFilters({
        preferredCountries: ["us", "CA", "US", "GB"],
        excludedCountries: ["ca", "MX", "FR"],
      }),
    ).toEqual({
      preferredCountries: ["US", "CA"],
      excludedCountries: ["MX", "FR"],
    });
  });
});

describe("getMatchingPhase", () => {
  it("uses strict matching in the first three seconds", () => {
    expect(getMatchingPhase(0)).toBe(1);
    expect(getMatchingPhase(2)).toBe(1);
  });

  it("relaxes preferred countries between three and six seconds", () => {
    expect(getMatchingPhase(3)).toBe(2);
    expect(getMatchingPhase(5)).toBe(2);
  });

  it("falls back to any valid user after six seconds", () => {
    expect(getMatchingPhase(6)).toBe(3);
    expect(getMatchingPhase(20)).toBe(3);
  });
});

describe("getMatchingRulesSummary", () => {
  it("phase 1 enforces preferred countries, exclusions, and recent-match avoidance", () => {
    expect(getMatchingRulesSummary(2)).toEqual({
      phase: 1,
      enforcePreferredCountries: true,
      enforceExcludedCountries: true,
      avoidRecentMatches: true,
    });
  });

  it("phase 2 relaxes preferred countries while keeping exclusions", () => {
    expect(getMatchingRulesSummary(4)).toEqual({
      phase: 2,
      enforcePreferredCountries: false,
      enforceExcludedCountries: true,
      avoidRecentMatches: false,
    });
  });

  it("phase 3 continues to allow any valid user except blocked or excluded cases", () => {
    expect(getMatchingRulesSummary(7)).toEqual({
      phase: 3,
      enforcePreferredCountries: false,
      enforceExcludedCountries: true,
      avoidRecentMatches: false,
    });
  });
});
