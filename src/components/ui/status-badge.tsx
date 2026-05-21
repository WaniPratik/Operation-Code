import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, string> = {
  success: "border border-mint/45 bg-panel text-ink",
  warning: "border border-ember/55 bg-panel text-ink",
  danger: "border border-danger/45 bg-panel text-danger",
  neutral: "border border-line bg-panel text-ink",
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
