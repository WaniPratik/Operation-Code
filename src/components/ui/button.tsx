import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white hover:bg-ink/90 focus-visible:outline-ember disabled:bg-ink/60 disabled:text-white/80",
  secondary:
    "border border-line bg-panel text-ink hover:border-ink/45 hover:bg-white focus-visible:outline-mint disabled:text-ink/55",
  ghost:
    "bg-transparent text-ink/82 hover:bg-sand/80 hover:text-ink focus-visible:outline-mint disabled:text-ink/55",
  danger:
    "bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger disabled:bg-danger/40",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:scale-100",
          variantStyles[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
