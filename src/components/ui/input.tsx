import * as React from "react";
import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-ink/35",
          error ? "border-danger" : "border-line",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
