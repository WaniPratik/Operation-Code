import { AdminService } from "@/server/services/admin-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";
import { getAdminErrorStatus, requireAdminSession } from "@/server/auth/admin-session";

const adminService = new AdminService();

export async function POST(
  request: Request,
  context: { params: Promise<{ matchId: string }> },
) {
  try {
    await requireAdminSession();
    const params = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const match = await adminService.endMatch(params.matchId, body.reason?.trim() || "admin_end");
    return jsonOk({ match });
  } catch (error) {
    return jsonError(
      getErrorMessage(error, "Unable to end match from admin."),
      getAdminErrorStatus(error) ?? 400,
    );
  }
}
