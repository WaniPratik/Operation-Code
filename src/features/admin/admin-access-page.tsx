"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { apiPost } from "@/lib/client/api";

export function AdminAccessPage({ configurationError }: { configurationError?: string | null }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(configurationError ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!password.trim()) {
      setError("Enter the admin password first.");
      return;
    }

    setSubmitting(true);
    setError(configurationError ?? null);

    try {
      await apiPost<{ authenticated: boolean }>("/api/admin/session", {
        password,
      });
      window.location.reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to sign in to admin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 p-6 sm:p-8">
        <SectionHeading
          eyebrow="Admin access"
          title="Protected moderation dashboard"
          description="This internal panel now uses a real password-protected admin session for MVP use. It is intentionally simple, but it is no longer an open developer page."
        />

        {configurationError ? (
          <Notice title="Admin setup required" tone="danger">
            {configurationError}
          </Notice>
        ) : (
          <Notice title="Founder-safe access" tone="info">
            Use the internal admin password to unlock active match controls, report details, block visibility, and audit history before beta testing.
          </Notice>
        )}

        <div className="space-y-4">
          <Field
            label="Admin password"
            hint="Set this through ADMIN_ACCESS_PASSWORD in .env.local."
            error={error ?? undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter the internal admin password"
              disabled={Boolean(configurationError) || submitting}
              error={Boolean(error)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </Field>

          <Button disabled={Boolean(configurationError) || submitting} onClick={() => void handleSubmit()}>
            {submitting ? "Unlocking..." : "Unlock admin dashboard"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
