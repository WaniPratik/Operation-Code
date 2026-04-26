import { AdminService } from "@/server/services/admin-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";
import { getAdminErrorStatus, requireAdminSession } from "@/server/auth/admin-session";

const adminService = new AdminService();

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const blocks = await adminService.getBlocks({
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
      userId: searchParams.get("userId"),
    });
    return jsonOk({ blocks });
  } catch (error) {
    return jsonError(
      getErrorMessage(error, "Unable to fetch blocks."),
      getAdminErrorStatus(error) ?? 400,
    );
  }
}
