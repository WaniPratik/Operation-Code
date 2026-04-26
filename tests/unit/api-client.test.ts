import { describe, expect, it } from "vitest";
import {
  ApiRequestError,
  isAdminSessionExpiredError,
  isSessionExpiredError,
  parseApiResponse,
} from "@/lib/client/api";

describe("parseApiResponse", () => {
  it("returns parsed JSON for a successful JSON response", async () => {
    const response = new Response(JSON.stringify({ session: { id: "session_1" } }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

    await expect(parseApiResponse<{ session: { id: string } }>(response, "/api/session")).resolves.toEqual({
      session: { id: "session_1" },
    });
  });

  it("surfaces a readable error when the server returns HTML", async () => {
    const response = new Response("<!DOCTYPE html><html><body>Server error</body></html>", {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });

    await expect(parseApiResponse(response, "/api/session")).rejects.toThrow(
      "Request to /api/session failed with status 500. The server returned HTML instead of JSON. If this is local or staging, check the server logs for the failing route.",
    );
  });

  it("classifies guest session failures as session-expired errors", async () => {
    const response = new Response(JSON.stringify({ error: "Guest session is required." }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });

    try {
      await parseApiResponse(response, "/api/queue");
      throw new Error("Expected parseApiResponse to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(isSessionExpiredError(error)).toBe(true);
      expect((error as ApiRequestError).message).toBe(
        "Your guest session expired or could not be verified. Start a fresh session to continue.",
      );
    }
  });

  it("classifies admin auth failures as admin-session-expired errors", async () => {
    const response = new Response(JSON.stringify({ error: "Admin authentication is required." }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });

    try {
      await parseApiResponse(response, "/api/admin/reports");
      throw new Error("Expected parseApiResponse to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(isAdminSessionExpiredError(error)).toBe(true);
      expect((error as ApiRequestError).message).toBe(
        "Your admin session expired. Reload /admin and sign in again.",
      );
    }
  });

  it("normalizes awkward queue retry errors into a user-facing message", async () => {
    const response = new Response(
      JSON.stringify({ error: "duplicate key value violates unique constraint \"queue_entries_active_user_idx\"" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    await expect(parseApiResponse(response, "/api/queue")).rejects.toThrow(
      "We hit a temporary retry issue. Refresh and try again.",
    );
  });

  it("normalizes stale match voice setup errors into a recoverable message", async () => {
    const response = new Response(
      JSON.stringify({ error: "Voice room is only available for an active match." }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    await expect(parseApiResponse(response, "/api/voice/token")).rejects.toThrow(
      "The live session is no longer ready. Refresh this page or return to the queue.",
    );
  });
});
