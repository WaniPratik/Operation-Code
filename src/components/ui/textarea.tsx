import * as React from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-28 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-ink/35",
          error ? "border-danger" : "border-line",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
