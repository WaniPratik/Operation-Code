import { cn } from "@/lib/cn";

type NoticeTone = "info" | "warning" | "danger";

const toneClasses: Record<NoticeTone, string> = {
  info: "border-line bg-sand/45 text-ink/80",
  warning: "border-ember/40 bg-ember/15 text-ink/85",
  danger: "border-danger/30 bg-danger/10 text-danger",
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
