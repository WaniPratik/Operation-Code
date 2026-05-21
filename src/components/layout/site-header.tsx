"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EchoMark } from "@/components/brand/echo-mark";
import { StatusBadge } from "@/components/ui/status-badge";
import { useGuestSession } from "@/features/session/guest-session-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const { session, loading, error } = useGuestSession();
  const adminLink = pathname.startsWith("/admin")
    ? { href: "/", label: "Back to app" }
    : { href: "/admin", label: "Admin" };

  return (
    <header className="mb-6 rounded-[1.75rem] border border-ember/30 bg-ink px-4 py-4 text-panel shadow-soft backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center gap-3">
            <EchoMark className="size-8 bg-panel text-ink" />
            <span className="rounded-full bg-ember px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-ink">
              Beta
            </span>
            <span className="font-heading text-lg font-semibold sm:text-xl">
              Echotalk.live
            </span>
          </Link>
          <p className="max-w-2xl text-sm text-panel/72">
            Fast guest voice matching with a live handoff and simple safety tools.
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
            className="text-sm font-medium text-panel/72 underline underline-offset-4 transition hover:text-panel"
          >
            {adminLink.label}
          </Link>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-panel">{error}</p> : null}
    </header>
  );
}
