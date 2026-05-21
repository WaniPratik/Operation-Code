"use client";

import { useState } from "react";
import { FEEDBACK_TYPES } from "@/lib/constants";
import { apiPost } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackType } from "@/types/domain";

interface FeedbackFormProps {
  matchId?: string | null;
  defaultType?: FeedbackType;
  compact?: boolean;
}

export function FeedbackForm({ matchId = null, defaultType = "suggestion", compact = false }: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(defaultType);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={compact ? "space-y-3" : "space-y-4 rounded-[1.75rem] border border-line bg-white/70 p-5"}>
      <div className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Beta feedback</p>
        <p className="text-sm leading-6 text-ink/64">Tell us what broke or what would make this smoother.</p>
      </div>

      {success ? (
        <Notice title="Feedback sent" tone="info">
          Thanks. This is linked to your beta session when available.
        </Notice>
      ) : null}

      <Field label="Type">
        <Select
          value={feedbackType}
          onChange={(event) => setFeedbackType(event.target.value as FeedbackType)}
        >
          {FEEDBACK_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Feedback">
        <Textarea
          value={feedbackText}
          onChange={(event) => setFeedbackText(event.target.value)}
          placeholder="What happened?"
        />
      </Field>

      {error ? (
        <Notice title="Could not send feedback" tone="warning">
          {error}
        </Notice>
      ) : null}

      <Button
        variant="secondary"
        className="w-full"
        disabled={submitting || feedbackText.trim().length === 0}
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          setSuccess(false);

          try {
            await apiPost("/api/feedback", {
              feedbackType,
              feedbackText,
              matchId,
            });
            setFeedbackText("");
            setSuccess(true);
          } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Unable to submit feedback.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? "Sending..." : "Send feedback"}
      </Button>
    </div>
  );
}
