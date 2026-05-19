import { afterEach, describe, expect, it, vi } from "vitest";

const getEnvReadinessReport = vi.fn();

vi.mock("@/server/env", () => ({
  getEnvReadinessReport,
}));

describe("GET /api/health", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 200 when readiness checks pass", async () => {
    getEnvReadinessReport.mockReturnValue({
      ok: true,
      checks: {
        appBoot: { status: "ready", message: "App server is responding." },
        appUrl: { status: "ready", message: "NEXT_PUBLIC_APP_URL is configured." },
        supabase: {
          status: "ready",
          message: "Supabase URL and service role key are configured.",
        },
        livekit: {
          status: "ready",
          message: "LiveKit URL and server credentials are configured.",
        },
        admin: { status: "ready", message: "Admin dashboard password is configured." },
      },
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      checks: expect.objectContaining({
        appBoot: { status: "ready", message: "App server is responding." },
      }),
    });
  });

  it("returns 503 with readable checks when readiness is incomplete", async () => {
    getEnvReadinessReport.mockReturnValue({
      ok: false,
      checks: {
        appBoot: { status: "ready", message: "App server is responding." },
        appUrl: {
          status: "missing",
          message: "NEXT_PUBLIC_APP_URL is missing. Set NEXT_PUBLIC_APP_URL in .env.local or staging to the public app origin, like http://localhost:3000 or https://beta.example.com.",
        },
        supabase: {
          status: "ready",
          message: "Supabase URL and service role key are configured.",
        },
        livekit: {
          status: "invalid",
          message: "NEXT_PUBLIC_LIVEKIT_URL must not include a path. Set NEXT_PUBLIC_LIVEKIT_URL to the LiveKit websocket URL, like wss://your-project.livekit.cloud or ws://localhost:7880.",
        },
        admin: { status: "ready", message: "Admin dashboard password is configured." },
      },
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "needs_attention",
      checks: expect.objectContaining({
        appUrl: expect.objectContaining({ status: "missing" }),
        livekit: expect.objectContaining({ status: "invalid" }),
      }),
    });
  });
});
