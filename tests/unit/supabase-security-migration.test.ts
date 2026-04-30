import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202604290001_supabase_security_hardening.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("supabase security migration", () => {
  it("enables RLS on internal tables and revokes browser-role table access", () => {
    expect(migration).toContain("alter table if exists public.users enable row level security;");
    expect(migration).toContain("alter table if exists public.audit_events enable row level security;");
    expect(migration).toMatch(/revoke all on table[\s\S]*public\.users[\s\S]*from public, anon, authenticated;/i);
  });

  it("pins explicit search_path and revokes public execute on matching RPCs", () => {
    expect(migration).toContain(
      "revoke execute on function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)",
    );
    expect(migration).toContain(
      "alter function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)",
    );
    expect(migration).toContain("set search_path = public, pg_temp;");
  });
});
