import { Notice } from "@/components/ui/notice";
import {
  getBetaRecoveryGuidance,
  type BetaSupportSurface,
} from "@/lib/beta-support";

interface BetaHelpNoticeProps {
  surface: BetaSupportSurface;
  tone?: "info" | "warning";
}

export function BetaHelpNotice({ surface, tone = "info" }: BetaHelpNoticeProps) {
  const guidance = getBetaRecoveryGuidance(surface);

  return (
    <Notice title={guidance.title} tone={tone}>
      <p>{guidance.intro}</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-inherit">
        {guidance.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </Notice>
  );
}
