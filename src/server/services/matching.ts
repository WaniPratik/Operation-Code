import { MVP_COUNTRY_FILTER_LIMIT } from "@/lib/constants";
import type { QueueFilters } from "@/types/domain";

export type MatchingPhase = 1 | 2 | 3;

export function normalizeCountryFilters(filters: QueueFilters): QueueFilters {
  const normalize = (values: string[]) =>
    Array.from(
      new Set(
        values
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
      ),
    );

  const preferredCountries = normalize(filters.preferredCountries).slice(0, MVP_COUNTRY_FILTER_LIMIT);
  const excludedCountries = normalize(filters.excludedCountries)
    .filter((country) => !preferredCountries.includes(country))
    .slice(0, MVP_COUNTRY_FILTER_LIMIT);

  return {
    preferredCountries,
    excludedCountries,
  };
}

export function getMatchingPhase(waitSeconds: number): MatchingPhase {
  if (waitSeconds < 3) {
    return 1;
  }

  if (waitSeconds < 6) {
    return 2;
  }

  return 3;
}

export function getMatchingRulesSummary(waitSeconds: number) {
  const phase = getMatchingPhase(waitSeconds);

  if (phase === 1) {
    return {
      phase,
      enforcePreferredCountries: true,
      enforceExcludedCountries: true,
      avoidRecentMatches: true,
    };
  }

  if (phase === 2) {
    return {
      phase,
      enforcePreferredCountries: false,
      enforceExcludedCountries: true,
      avoidRecentMatches: false,
    };
  }

  return {
    phase,
    enforcePreferredCountries: false,
    enforceExcludedCountries: true,
    avoidRecentMatches: false,
  };
}
