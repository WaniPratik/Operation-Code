"use client";

import { GuestSessionProvider } from "@/features/session/guest-session-provider";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuestSessionProvider>{children}</GuestSessionProvider>;
}
