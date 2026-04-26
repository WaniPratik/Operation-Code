"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, isSessionExpiredError } from "@/lib/client/api";
import type { GuestSessionView } from "@/types/domain";

interface SessionContextValue {
  session: GuestSessionView | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  ensureSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  restartSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function GuestSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<GuestSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await apiGet<{ session: GuestSessionView }>("/api/session");
      setSession(payload.session);
      setSessionExpired(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to fetch session.";
      setSession(null);
      setSessionExpired(isSessionExpiredError(caughtError));
      setError(message);
      throw caughtError;
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await apiPost<{ session: GuestSessionView }>("/api/session");
      setSession(payload.session);
      setSessionExpired(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to create session.";
      setSession(null);
      setSessionExpired(false);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const restartSession = useCallback(async () => {
    await ensureSession();
  }, [ensureSession]);

  useEffect(() => {
    void ensureSession().catch(() => undefined);
  }, [ensureSession]);

  const value = useMemo(
    () => ({
      session,
      loading,
      error,
      sessionExpired,
      ensureSession,
      refreshSession,
      restartSession,
    }),
    [ensureSession, error, loading, refreshSession, restartSession, session, sessionExpired],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useGuestSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useGuestSession must be used within GuestSessionProvider.");
  }

  return context;
}
