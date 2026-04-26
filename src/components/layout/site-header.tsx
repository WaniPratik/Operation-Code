"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { useGuestSession } from "@/features/session/guest-session-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const { session, loading, error } = useGuestSession();
  const adminLink = pathname.startsWith("/admin")
    ? { href: "/", label: "Back to app" }
    : { href: "/admin", label: "Admin" };

  return (
    <header className="mb-6 rounded-[1.75rem] border border-line/80 bg-panel/90 px-4 py-4 shadow-soft backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="rounded-full bg-ember px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-white">
              Beta MVP
            </span>
            <span className="font-heading text-lg font-semibold sm:text-xl">
              Anonymous Voice Match
            </span>
          </Link>
          <p className="max-w-2xl text-sm text-ink/70">
            Guest-first voice matching with a fast queue, live voice handoff, and simple safety tools.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={error ? "warning" : session ? "neutral" : "warning"}>
              {loading ? "Preparing session" : session ? `Guest ${session.handle}` : "Session unavailable"}
            </StatusBadge>
            <StatusBadge tone={session?.onboardingCompleted ? "success" : "warning"}>
              {session?.onboardingCompleted ? "Ready to match" : "18+ step left"}
            </StatusBadge>
          </div>

          <Link
            href={adminLink.href}
            className="text-sm font-medium text-ink/70 underline underline-offset-4 transition hover:text-ink"
          >
            {adminLink.label}
          </Link>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </header>
  );
}
