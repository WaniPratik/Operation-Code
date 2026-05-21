import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202605210001_beta_feedback_auth_controls.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const optionalTextMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202605210002_feedback_optional_text.sql"),
  "utf8",
);

describe("beta feedback migration", () => {
  it("creates feedback and beta control tables with RLS enabled", () => {
    expect(migration).toContain("create table if not exists public.feedback_submissions");
    expect(migration).toContain("create table if not exists public.beta_rate_limits");
    expect(migration).toContain("create table if not exists public.beta_user_cooldowns");
    expect(migration).toContain("alter table public.feedback_submissions enable row level security;");
    expect(migration).toContain("alter table public.beta_rate_limits enable row level security;");
    expect(migration).toContain("alter table public.beta_user_cooldowns enable row level security;");
  });

  it("keeps beta tables server-only for MVP data access", () => {
    expect(migration).toMatch(/revoke all on table[\s\S]*public\.feedback_submissions[\s\S]*from public, anon, authenticated;/i);
    expect(migration).toMatch(/grant all on table[\s\S]*public\.feedback_submissions[\s\S]*to service_role;/i);
  });

  it("allows type-only feedback notes for low-friction beta reporting", () => {
    expect(optionalTextMigration).toContain("drop constraint if exists feedback_text_length");
    expect(optionalTextMigration).toContain("check (char_length(feedback_text) <= 1000)");
  });
});
