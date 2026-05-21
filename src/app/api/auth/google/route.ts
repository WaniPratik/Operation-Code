import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { env } from "@/server/env";

function getOptionalEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export async function GET() {
  const anonKey = getOptionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!anonKey) {
    return NextResponse.redirect(
      new URL("/?auth=google-setup-needed", env.appUrl),
      { status: 302 },
    );
  }

  const supabase = createClient(env.supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.appUrl}/onboarding`,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(
      new URL("/?auth=google-unavailable", env.appUrl),
      { status: 302 },
    );
  }

  return NextResponse.redirect(data.url, { status: 302 });
}
