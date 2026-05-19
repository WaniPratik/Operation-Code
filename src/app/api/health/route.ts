import { getEnvReadinessReport } from "@/server/env";
import { jsonOk } from "@/server/http";

export async function GET() {
  const report = getEnvReadinessReport();

  return jsonOk(
    {
      status: report.ok ? "ok" : "needs_attention",
      checks: report.checks,
    },
    {
      status: report.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
