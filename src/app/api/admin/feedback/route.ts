import { requireAdminSession, getAdminErrorStatus } from "@/server/auth/admin-session";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";
import { AdminService } from "@/server/services/admin-service";

const adminService = new AdminService();

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const params = new URL(request.url).searchParams;
    const feedback = await adminService.getFeedback({
      userId: params.get("userId"),
      type: params.get("type"),
      dateFrom: params.get("dateFrom"),
      dateTo: params.get("dateTo"),
    });

    return jsonOk({ feedback });
  } catch (error) {
    return jsonError(
      getErrorMessage(error, "Unable to fetch feedback."),
      getAdminErrorStatus(error),
    );
  }
}
