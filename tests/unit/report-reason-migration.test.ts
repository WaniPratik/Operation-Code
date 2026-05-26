import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202605260001_report_reason_spam_bot.sql"),
  "utf8",
);

describe("report reason migration", () => {
  it("keeps the current spam/bot report reason compatible with the database enum", () => {
    expect(migration).toContain("alter type public.report_reason add value if not exists 'spam/bot'");
  });
});
