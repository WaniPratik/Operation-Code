import { cn } from "@/lib/cn";

type NoticeTone = "info" | "warning" | "danger";

const toneClasses: Record<NoticeTone, string> = {
  info: "border-line bg-panel/95 text-ink",
  warning: "border-ember bg-panel/95 text-ink",
  danger: "border-danger/50 bg-panel/95 text-danger",
};

export function Notice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: React.ReactNode;
  tone?: NoticeTone;
}) {
  return (
    <div className={cn("rounded-3xl border p-4", toneClasses[tone])}>
      <p className="font-mono text-xs uppercase tracking-[0.2em]">{title}</p>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}
