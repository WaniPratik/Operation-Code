import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  ADMIN_ACCESS_PASSWORD: process.env.ADMIN_ACCESS_PASSWORD,
};

function setHealthyEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.NEXT_PUBLIC_LIVEKIT_URL = "https://example.livekit.cloud/";
  process.env.LIVEKIT_API_KEY = "key";
  process.env.LIVEKIT_API_SECRET = "secret";
  process.env.ADMIN_ACCESS_PASSWORD = "local-admin-password";
}

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_LIVEKIT_URL = originalEnv.NEXT_PUBLIC_LIVEKIT_URL;
  process.env.LIVEKIT_API_KEY = originalEnv.LIVEKIT_API_KEY;
  process.env.LIVEKIT_API_SECRET = originalEnv.LIVEKIT_API_SECRET;
  process.env.ADMIN_ACCESS_PASSWORD = originalEnv.ADMIN_ACCESS_PASSWORD;
  vi.resetModules();
});

describe("env url normalization", () => {
  it("normalizes a project URL that includes /rest/v1", async () => {
    setHealthyEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co/rest/v1/";

    const { env } = await import("@/server/env");

    expect(env.supabaseUrl).toBe("https://example-project.supabase.co");
  });

  it("normalizes an https LiveKit URL into the websocket client URL", async () => {
    setHealthyEnv();

    const { env } = await import("@/server/env");

    expect(env.livekitUrl).toBe("wss://example.livekit.cloud");
    expect(env.livekitServerUrl).toBe("https://example.livekit.cloud");
  });

  it("normalizes NEXT_PUBLIC_APP_URL to its origin", async () => {
    setHealthyEnv();
    process.env.NEXT_PUBLIC_APP_URL = "https://beta.example.com/";

    const { env } = await import("@/server/env");

    expect(env.appUrl).toBe("https://beta.example.com");
  });
});

describe("env validation", () => {
  it("rejects unsupported Supabase URL paths with a readable fix hint", async () => {
    setHealthyEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co/bad-path";

    const { env } = await import("@/server/env");

    expect(() => env.supabaseUrl).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL must be the project root URL. Received unsupported path: /bad-path. Set NEXT_PUBLIC_SUPABASE_URL to the Supabase project root URL, like https://your-project.supabase.co.",
    );
  });

  it("rejects LiveKit URLs that include a path", async () => {
    setHealthyEnv();
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://example.livekit.cloud/twirp";

    const { env } = await import("@/server/env");

    expect(() => env.livekitUrl).toThrow(
      "NEXT_PUBLIC_LIVEKIT_URL must not include a path. Received unsupported path: /twirp. Set NEXT_PUBLIC_LIVEKIT_URL to the LiveKit websocket URL, like wss://your-project.livekit.cloud or ws://localhost:7880.",
    );
  });

  it("rejects placeholder service credentials with a readable fix hint", async () => {
    setHealthyEnv();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key";

    const { env } = await import("@/server/env");

    expect(() => env.supabaseServiceRoleKey).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is still using the example placeholder value. Set SUPABASE_SERVICE_ROLE_KEY to the server-side service_role key from Supabase Project Settings > API.",
    );
  });
});

describe("getEnvReadinessReport", () => {
  it("reports healthy config without exposing secrets", async () => {
    setHealthyEnv();

    const { getEnvReadinessReport } = await import("@/server/env");
    const report = getEnvReadinessReport();

    expect(report.ok).toBe(true);
    expect(report.checks.supabase).toEqual({
      status: "ready",
      message: "Supabase URL and service role key are configured.",
    });
    expect(JSON.stringify(report)).not.toContain("service-key");
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("reports missing and invalid checks with founder-readable guidance", async () => {
    setHealthyEnv();
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://example.livekit.cloud/twirp";

    const { getEnvReadinessReport } = await import("@/server/env");
    const report = getEnvReadinessReport();

    expect(report.ok).toBe(false);
    expect(report.checks.appUrl.status).toBe("missing");
    expect(report.checks.appUrl.message).toContain("NEXT_PUBLIC_APP_URL is missing.");
    expect(report.checks.livekit.status).toBe("invalid");
    expect(report.checks.livekit.message).toContain("NEXT_PUBLIC_LIVEKIT_URL must not include a path.");
  });
});
