type ReadinessStatus = "ready" | "missing" | "invalid";

interface ReadinessCheck {
  status: ReadinessStatus;
  message: string;
}

interface EnvReadinessReport {
  ok: boolean;
  checks: {
    appBoot: ReadinessCheck;
    appUrl: ReadinessCheck;
    supabase: ReadinessCheck;
    livekit: ReadinessCheck;
    admin: ReadinessCheck;
  };
}

const ENV_HINTS: Record<string, string> = {
  NEXT_PUBLIC_APP_URL:
    "Set NEXT_PUBLIC_APP_URL in .env.local or staging to the public app origin, like http://localhost:3000 or https://beta.example.com.",
  NEXT_PUBLIC_SUPABASE_URL:
    "Set NEXT_PUBLIC_SUPABASE_URL to the Supabase project root URL, like https://your-project.supabase.co.",
  SUPABASE_SERVICE_ROLE_KEY:
    "Set SUPABASE_SERVICE_ROLE_KEY to the server-side service_role key from Supabase Project Settings > API.",
  NEXT_PUBLIC_LIVEKIT_URL:
    "Set NEXT_PUBLIC_LIVEKIT_URL to the LiveKit websocket URL, like wss://your-project.livekit.cloud or ws://localhost:7880.",
  LIVEKIT_API_KEY:
    "Set LIVEKIT_API_KEY to the server-side LiveKit API key used for token minting.",
  LIVEKIT_API_SECRET:
    "Set LIVEKIT_API_SECRET to the server-side LiveKit API secret used for token minting and room cleanup.",
  ADMIN_ACCESS_PASSWORD:
    "Set ADMIN_ACCESS_PASSWORD to the shared internal password used to unlock /admin.",
};

const PLACEHOLDER_VALUES: Record<string, string[]> = {
  NEXT_PUBLIC_APP_URL: ["http://localhost:3000-placeholder"],
  NEXT_PUBLIC_SUPABASE_URL: ["https://your-project.supabase.co"],
  SUPABASE_SERVICE_ROLE_KEY: ["your-service-role-key"],
  NEXT_PUBLIC_LIVEKIT_URL: ["wss://your-project.livekit.cloud"],
  LIVEKIT_API_KEY: ["your-livekit-api-key"],
  LIVEKIT_API_SECRET: ["your-livekit-api-secret"],
  ADMIN_ACCESS_PASSWORD: ["change-this-local-admin-password"],
};

function getRawEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function failEnv(name: string, reason: string): never {
  throw new Error(`${reason} ${ENV_HINTS[name]}`.trim());
}

function parseUrlOrFail(value: string, name: string, invalidMessage: string): URL {
  try {
    return new URL(value);
  } catch {
    failEnv(name, invalidMessage);
  }
}

function requireEnv(name: string) {
  const value = getRawEnv(name);

  if (!value) {
    failEnv(name, `${name} is missing.`);
  }

  if (PLACEHOLDER_VALUES[name]?.includes(value)) {
    failEnv(name, `${name} is still using the example placeholder value.`);
  }

  return value;
}

function normalizeOriginUrl(value: string, name: string) {
  const parsed = parseUrlOrFail(value, name, `${name} must be a full URL.`);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    failEnv(name, `${name} must start with http:// or https://.`);
  }

  const trimmedPath = parsed.pathname.replace(/\/+$/, "");

  if (!["", "/"].includes(trimmedPath)) {
    failEnv(name, `${name} must be the origin only, without an extra path.`);
  }

  return parsed.origin;
}

function normalizeSupabaseUrl(value: string) {
  const parsed = parseUrlOrFail(
    value,
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL must be a full URL like https://your-project.supabase.co.",
  );

  if (!["http:", "https:"].includes(parsed.protocol)) {
    failEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL must start with http:// or https://.",
    );
  }

  const trimmedPath = parsed.pathname.replace(/\/+$/, "");

  if (["", "/"].includes(trimmedPath)) {
    return parsed.origin;
  }

  if (["/rest/v1", "/auth/v1", "/storage/v1"].includes(trimmedPath)) {
    return parsed.origin;
  }

  failEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    `NEXT_PUBLIC_SUPABASE_URL must be the project root URL. Received unsupported path: ${trimmedPath}.`,
  );
}

function normalizeLiveKitUrl(value: string) {
  const parsed = parseUrlOrFail(
    value,
    "NEXT_PUBLIC_LIVEKIT_URL",
    "NEXT_PUBLIC_LIVEKIT_URL must be a full URL like wss://your-project.livekit.cloud or ws://localhost:7880.",
  );

  const trimmedPath = parsed.pathname.replace(/\/+$/, "");

  if (!["", "/"].includes(trimmedPath)) {
    failEnv(
      "NEXT_PUBLIC_LIVEKIT_URL",
      `NEXT_PUBLIC_LIVEKIT_URL must not include a path. Received unsupported path: ${trimmedPath}.`,
    );
  }

  if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  } else if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  } else if (!["ws:", "wss:"].includes(parsed.protocol)) {
    failEnv(
      "NEXT_PUBLIC_LIVEKIT_URL",
      "NEXT_PUBLIC_LIVEKIT_URL must use ws://, wss://, http://, or https://.",
    );
  }

  return parsed.origin;
}

function toLiveKitServerUrl(livekitUrl: string) {
  const parsed = new URL(livekitUrl);
  parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
  return parsed.origin;
}

function getCheckStatus(error: unknown): ReadinessStatus {
  if (!(error instanceof Error)) {
    return "invalid";
  }

  return / is missing\./i.test(error.message) ? "missing" : "invalid";
}

function getCheckMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function createReadinessCheck(getter: () => unknown, successMessage: string): ReadinessCheck {
  try {
    getter();
    return {
      status: "ready",
      message: successMessage,
    };
  } catch (error) {
    return {
      status: getCheckStatus(error),
      message: getCheckMessage(error, "Configuration check failed."),
    };
  }
}

export function getEnvReadinessReport(): EnvReadinessReport {
  const checks = {
    appBoot: {
      status: "ready",
      message: "App server is responding.",
    } satisfies ReadinessCheck,
    appUrl: createReadinessCheck(
      () => normalizeOriginUrl(requireEnv("NEXT_PUBLIC_APP_URL"), "NEXT_PUBLIC_APP_URL"),
      "NEXT_PUBLIC_APP_URL is configured.",
    ),
    supabase: createReadinessCheck(
      () => {
        normalizeSupabaseUrl(requireEnv("NEXT_PUBLIC_SUPABASE_URL"));
        requireEnv("SUPABASE_SERVICE_ROLE_KEY");
      },
      "Supabase URL and service role key are configured.",
    ),
    livekit: createReadinessCheck(
      () => {
        normalizeLiveKitUrl(requireEnv("NEXT_PUBLIC_LIVEKIT_URL"));
        requireEnv("LIVEKIT_API_KEY");
        requireEnv("LIVEKIT_API_SECRET");
      },
      "LiveKit URL and server credentials are configured.",
    ),
    admin: createReadinessCheck(
      () => requireEnv("ADMIN_ACCESS_PASSWORD"),
      "Admin dashboard password is configured.",
    ),
  };

  return {
    ok: Object.values(checks).every((check) => check.status === "ready"),
    checks,
  };
}

export const env = {
  get appUrl() {
    return normalizeOriginUrl(requireEnv("NEXT_PUBLIC_APP_URL"), "NEXT_PUBLIC_APP_URL");
  },
  get supabaseUrl() {
    return normalizeSupabaseUrl(requireEnv("NEXT_PUBLIC_SUPABASE_URL"));
  },
  get supabaseServiceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get livekitUrl() {
    return normalizeLiveKitUrl(requireEnv("NEXT_PUBLIC_LIVEKIT_URL"));
  },
  get livekitServerUrl() {
    return toLiveKitServerUrl(this.livekitUrl);
  },
  get livekitApiKey() {
    return requireEnv("LIVEKIT_API_KEY");
  },
  get livekitApiSecret() {
    return requireEnv("LIVEKIT_API_SECRET");
  },
  get adminAccessPassword() {
    return requireEnv("ADMIN_ACCESS_PASSWORD");
  },
};
