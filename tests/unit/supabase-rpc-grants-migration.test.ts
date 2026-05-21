import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202605200001_grant_service_role_internal_rpcs.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("service-role RPC grants migration", () => {
  it("grants internal matchmaking and match-ending RPC execution to service_role only", () => {
    expect(migration).toContain(
      "grant execute on function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)",
    );
    expect(migration).toContain("grant execute on function public.claim_tiered_match(uuid)");
    expect(migration).toContain("grant execute on function public.end_match_transactional(uuid, uuid, text)");
    expect(migration).toContain("grant execute on function public.admin_end_match_transactional(uuid, text)");
    expect(migration).toMatch(/to service_role;/i);
    expect(migration).not.toMatch(/to\s+(public|anon|authenticated);/i);
  });
});
