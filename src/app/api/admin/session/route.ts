import { getErrorMessage, jsonError, jsonOk } from "@/server/http";
import {
  applyAdminSessionCookie,
  clearAdminSessionCookie,
  getAdminErrorStatus,
  verifyAdminPassword,
} from "@/server/auth/admin-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    const password = body.password?.trim() ?? "";

    if (!password) {
      return jsonError("Password is required.", 400);
    }

    if (!verifyAdminPassword(password)) {
      return jsonError("Incorrect admin password.", 401);
    }

    const response = jsonOk({ authenticated: true });
    applyAdminSessionCookie(response);
    return response;
  } catch (error) {
    return jsonError(
      getErrorMessage(error, "Unable to sign in to admin."),
      getAdminErrorStatus(error) ?? 500,
    );
  }
}

export async function DELETE() {
  const response = jsonOk({ authenticated: false });
  clearAdminSessionCookie(response);
  return response;
}
