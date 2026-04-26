"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { useGuestSession } from "@/features/session/guest-session-provider";

export function LandingPage() {
  const { session, loading, error } = useGuestSession();
  const primaryHref = session?.onboardingCompleted ? "/queue" : "/onboarding";

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden bg-hero-glow p-6 sm:p-8 lg:p-10">
        <div className="space-y-6 text-center">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-ember">
              Anonymous voice
            </p>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Talk freely.
            </h1>
            <p className="mx-auto max-w-md text-base leading-7 text-ink/72">
              Anonymous voice chat. No sign-up.
            </p>
          </div>

          {error ? (
            <Notice title="We hit a setup snag" tone="warning">
              {error}
            </Notice>
          ) : null}

          <div className="space-y-3">
            <Link
              href={primaryHref}
              aria-disabled={loading}
              className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition duration-150 active:translate-y-px active:scale-[0.99] sm:w-auto ${
                loading
                  ? "pointer-events-none bg-ink/40 text-white"
                  : "bg-ink text-white hover:bg-ink/90"
              }`}
            >
              Jump In
            </Link>
            <p className="text-sm text-ink/62">
              {loading
                ? "Setting up your private guest session."
                : "One quick 18+ check, then you’re in."}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
