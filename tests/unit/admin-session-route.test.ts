import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyAdminPassword = vi.fn();
const applyAdminSessionCookie = vi.fn((response) => response);
const clearAdminSessionCookie = vi.fn((response) => response);
const getAdminErrorStatus = vi.fn();

vi.mock("@/server/auth/admin-session", () => ({
  verifyAdminPassword,
  applyAdminSessionCookie,
  clearAdminSessionCookie,
  getAdminErrorStatus,
}));

describe("/api/admin/session", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates an admin session cookie when the password is correct", async () => {
    verifyAdminPassword.mockReturnValue(true);

    const { POST } = await import("@/app/api/admin/session/route");
    const response = await POST(
      new Request("http://localhost:3000/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "secret-password" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: true });
    expect(applyAdminSessionCookie).toHaveBeenCalledTimes(1);
  });

  it("rejects an incorrect admin password without setting the cookie", async () => {
    verifyAdminPassword.mockReturnValue(false);

    const { POST } = await import("@/app/api/admin/session/route");
    const response = await POST(
      new Request("http://localhost:3000/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Incorrect admin password." });
    expect(applyAdminSessionCookie).not.toHaveBeenCalled();
  });

  it("clears the admin session cookie on sign out", async () => {
    const { DELETE } = await import("@/app/api/admin/session/route");
    const response = await DELETE();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(clearAdminSessionCookie).toHaveBeenCalledTimes(1);
  });
});
