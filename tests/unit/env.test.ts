import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_LIVEKIT_URL = originalEnv.NEXT_PUBLIC_LIVEKIT_URL;
  process.env.LIVEKIT_API_KEY = originalEnv.LIVEKIT_API_KEY;
  process.env.LIVEKIT_API_SECRET = originalEnv.LIVEKIT_API_SECRET;
  vi.resetModules();
});

describe("env.supabaseUrl", () => {
  it("normalizes a project URL that includes /rest/v1", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co/rest/v1/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const { env } = await import("@/server/env");

    expect(env.supabaseUrl).toBe("https://example-project.supabase.co");
  });

  it("rejects unsupported URL paths", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co/bad-path";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const { env } = await import("@/server/env");

    expect(() => env.supabaseUrl).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL must be the project root URL. Received unsupported path: /bad-path",
    );
  });
});

describe("env.livekitUrl", () => {
  it("normalizes an https LiveKit URL into the websocket client URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "https://example.livekit.cloud/";
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";

    const { env } = await import("@/server/env");

    expect(env.livekitUrl).toBe("wss://example.livekit.cloud");
    expect(env.livekitServerUrl).toBe("https://example.livekit.cloud");
  });

  it("rejects LiveKit URLs that include a path", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://example.livekit.cloud/twirp";
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";

    const { env } = await import("@/server/env");

    expect(() => env.livekitUrl).toThrow(
      "NEXT_PUBLIC_LIVEKIT_URL must not include a path. Received unsupported path: /twirp",
    );
  });
});
