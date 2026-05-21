import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, string> = {
  success: "bg-mint/20 text-ink",
  warning: "bg-ember/20 text-ink",
  danger: "bg-danger/12 text-danger",
  neutral: "bg-sand text-ink",
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
