"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EchoMark } from "@/components/brand/echo-mark";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { useGuestSession } from "@/features/session/guest-session-provider";

export function LandingPage() {
  const { session, loading, error } = useGuestSession();
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const primaryHref = session?.onboardingCompleted ? "/queue" : "/onboarding";

  useEffect(() => {
    const authStatus = new URLSearchParams(window.location.search).get("auth");

    if (authStatus === "google-setup-needed") {
      setAuthNotice("Google sign-in is not configured yet. Guest mode is ready.");
    } else if (authStatus === "google-unavailable") {
      setAuthNotice("Google sign-in is unavailable right now. Guest mode is ready.");
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden bg-hero-glow p-6 sm:p-8 lg:p-10">
        <div className="space-y-6 text-center">
          <div className="space-y-3 text-panel">
            <div className="flex justify-center">
              <EchoMark className="size-12 bg-panel text-ink" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-panel/86">
              Echotalk.live
            </p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
              Talk freely.
            </h1>
            <p className="mx-auto max-w-md text-base leading-7 text-panel/86">
              Anonymous voice chat with a quick echo across the room. No sign-up.
            </p>
          </div>

          <div className="mx-auto flex max-w-xs items-end justify-center gap-1.5 opacity-70" aria-hidden="true">
            {[10, 18, 28, 16, 34, 22, 12].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="w-1 rounded-full bg-ember"
                style={{ height }}
              />
            ))}
          </div>

          {error ? (
            <Notice title="We hit a setup snag" tone="warning">
              {error}
            </Notice>
          ) : null}

          {authNotice ? (
            <Notice title="Google is optional" tone="info">
              {authNotice}
            </Notice>
          ) : null}

          <div className="space-y-3">
            <Link
              href={primaryHref}
              aria-disabled={loading}
              className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition duration-150 active:translate-y-px active:scale-[0.99] sm:w-auto ${
                loading
                  ? "pointer-events-none bg-panel/45 text-panel/85"
                  : "bg-panel text-ink hover:bg-panel/90"
              }`}
            >
              Jump In
            </Link>
            <a
              href="/api/auth/google"
              className="inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-panel/86 transition duration-150 hover:bg-panel/10 hover:text-panel active:translate-y-px active:scale-[0.99] sm:w-auto"
            >
              Sign in with Google
            </a>
            <p className="text-sm text-panel/82">
              {loading
                ? "Setting up your private guest session."
                : "Guest stays instant. Google is optional for beta testers."}
            </p>
          </div>

          <div className="rounded-3xl border border-panel/20 bg-panel/10 p-4 text-left text-sm leading-6 text-panel/86">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-panel/86">
              Beta rules
            </p>
            <ul className="mt-2 space-y-1">
              <li>18+ only.</li>
              <li>Be respectful. Harassment, sexual content, and spam/bot behavior can be reported.</li>
              <li>Report & Skip and Block are available during and after calls.</li>
              <li>This is a beta, so bugs may happen.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
