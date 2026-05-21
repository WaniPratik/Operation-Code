"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackForm } from "@/components/ui/feedback-form";
import type { FeedbackType } from "@/types/domain";

interface FeedbackPromptProps {
  matchId?: string | null;
  defaultType?: FeedbackType;
  label?: string;
  compact?: boolean;
}

export function FeedbackPrompt({
  matchId = null,
  defaultType = "suggestion",
  label = "Send feedback",
  compact = true,
}: FeedbackPromptProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (open) {
    return (
      <FeedbackForm
        matchId={matchId}
        defaultType={defaultType}
        compact={compact}
        onCancel={() => setOpen(false)}
        onSubmitted={() => {
          setOpen(false);
          setSent(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {sent ? <p className="text-sm text-ink/58">Thanks. Feedback sent.</p> : null}
    </div>
  );
}
