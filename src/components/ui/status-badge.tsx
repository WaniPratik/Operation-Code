import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, string> = {
  success: "bg-mint/15 text-mint",
  warning: "bg-ember/12 text-ember",
  danger: "bg-danger/12 text-danger",
  neutral: "bg-sand text-ink/70",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span className={cn("rounded-full px-3 py-1 font-mono text-xs tracking-[0.15em]", toneStyles[tone])}>
      {children}
    </span>
  );
}
