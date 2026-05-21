"use client";

import { useState } from "react";
import { FeedbackForm } from "@/components/ui/feedback-form";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {open ? (
        <div className="w-[min(22rem,calc(100vw-2rem))] rounded-[1.5rem] border border-line bg-panel/95 p-4 shadow-soft backdrop-blur">
          <FeedbackForm
            compact
            onCancel={() => setOpen(false)}
            onSubmitted={() => {
              setOpen(false);
              setSent(true);
            }}
          />
        </div>
      ) : null}
      {sent && !open ? (
        <p className="rounded-full bg-panel/95 px-3 py-2 text-xs text-ink/62 shadow-soft">Feedback sent.</p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setSent(false);
          setOpen((value) => !value);
        }}
        className="rounded-full border border-line bg-panel/90 px-4 py-2 text-xs font-medium text-ink/64 shadow-soft backdrop-blur transition hover:border-ink/30 hover:text-ink active:translate-y-px active:scale-[0.99]"
      >
        Feedback
      </button>
    </div>
  );
}
