import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { COUNTRY_OPTIONS } from "@/lib/constants";

const SUPPORTED_COUNTRY_CODES = new Set<string>(COUNTRY_OPTIONS.map((country) => country.code));

function normalizeCountryCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();

  if (!normalized || normalized === "XX") {
    return null;
  }

  return SUPPORTED_COUNTRY_CODES.has(normalized) ? normalized : null;
}

function getCountryFromAcceptLanguage(value: string | null) {
  if (!value) {
    return null;
  }

  const locales = value
    .split(",")
    .map((entry) => entry.split(";")[0]?.trim().replaceAll("_", "-"));

  for (const locale of locales) {
    if (!locale) {
      continue;
    }

    const parts = locale.split("-");
    const region = parts.length > 1 ? parts.at(-1) : null;
    const normalized = normalizeCountryCode(region);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export async function createRequestFingerprintHash() {
  const requestHeaders = await headers();
  const raw = [
    requestHeaders.get("user-agent") ?? "unknown",
    requestHeaders.get("accept-language") ?? "unknown",
    requestHeaders.get("x-forwarded-for") ?? "unknown",
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}

export async function detectRequestCountryCode() {
  const requestHeaders = await headers();
  const directCandidateHeaders = [
    requestHeaders.get("x-vercel-ip-country"),
    requestHeaders.get("cf-ipcountry"),
    requestHeaders.get("x-country-code"),
    requestHeaders.get("x-country"),
    requestHeaders.get("x-appengine-country"),
  ];

  for (const candidate of directCandidateHeaders) {
    const normalized = normalizeCountryCode(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return getCountryFromAcceptLanguage(requestHeaders.get("accept-language"));
}
