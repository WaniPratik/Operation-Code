import { cn } from "@/lib/cn";

export function EchoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-full bg-ink text-panel shadow-soft",
        className,
      )}
    >
      <span className="absolute size-9 rounded-full border border-ember/45 animate-echo-ripple" />
      <span className="absolute size-9 rounded-full border border-ink/25 animate-echo-ripple [animation-delay:650ms]" />
      <span className="flex items-end gap-0.5">
        <span className="h-2 w-1 rounded-full bg-ember" />
        <span className="h-4 w-1 rounded-full bg-panel" />
        <span className="h-3 w-1 rounded-full bg-ember/80" />
      </span>
    </span>
  );
}
