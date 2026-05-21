"use client";

import { COUNTRY_OPTIONS, MVP_COUNTRY_FILTER_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/cn";

export function CountryFilterPicker({
  label,
  selected,
  onToggle,
  disabledCodes = [],
}: {
  label: string;
  selected: string[];
  onToggle: (countryCode: string) => void;
  disabledCodes?: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink/72">
          up to {MVP_COUNTRY_FILTER_LIMIT}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {COUNTRY_OPTIONS.map((country) => {
          const isSelected = selected.includes(country.code);
          const isDisabled =
            (!isSelected && selected.length >= MVP_COUNTRY_FILTER_LIMIT) ||
            disabledCodes.includes(country.code);

          return (
            <button
              key={country.code}
              type="button"
              onClick={() => onToggle(country.code)}
              disabled={isDisabled}
              className={cn(
                "rounded-full border px-3 py-2 text-sm transition",
                isSelected
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink/75 hover:border-ink/30",
                isDisabled ? "cursor-not-allowed opacity-40" : "",
              )}
            >
              {country.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
