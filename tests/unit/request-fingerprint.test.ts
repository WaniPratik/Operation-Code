import { afterEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

describe("detectRequestCountryCode", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("prefers direct country headers when available", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-vercel-ip-country": "CA",
        "accept-language": "en-US,en;q=0.9",
      }),
    );

    const { detectRequestCountryCode } = await import("@/server/auth/request-fingerprint");

    await expect(detectRequestCountryCode()).resolves.toBe("CA");
  });

  it("falls back to the locale region in accept-language", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "accept-language": "en-US,en;q=0.9",
      }),
    );

    const { detectRequestCountryCode } = await import("@/server/auth/request-fingerprint");

    await expect(detectRequestCountryCode()).resolves.toBe("US");
  });

  it("returns null when no supported country can be inferred", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "accept-language": "en",
      }),
    );

    const { detectRequestCountryCode } = await import("@/server/auth/request-fingerprint");

    await expect(detectRequestCountryCode()).resolves.toBeNull();
  });
});
