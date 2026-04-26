function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeSupabaseUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a full URL like https://your-project-ref.supabase.co.",
    );
  }

  const trimmedPath = parsed.pathname.replace(/\/+$/, "");

  if (["", "/"].includes(trimmedPath)) {
    return parsed.origin;
  }

  if (["/rest/v1", "/auth/v1", "/storage/v1"].includes(trimmedPath)) {
    return parsed.origin;
  }

  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL must be the project root URL. Received unsupported path: ${trimmedPath}`,
  );
}

function normalizeLiveKitUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_LIVEKIT_URL must be a full URL like wss://your-project.livekit.cloud or ws://localhost:7880.",
    );
  }

  const trimmedPath = parsed.pathname.replace(/\/+$/, "");

  if (!["", "/"].includes(trimmedPath)) {
    throw new Error(
      `NEXT_PUBLIC_LIVEKIT_URL must not include a path. Received unsupported path: ${trimmedPath}`,
    );
  }

  if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  } else if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  } else if (!["ws:", "wss:"].includes(parsed.protocol)) {
    throw new Error(
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

export const env = {
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
