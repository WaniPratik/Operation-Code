import { AdminService } from "@/server/services/admin-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";
import { getAdminErrorStatus, requireAdminSession } from "@/server/auth/admin-session";

const adminService = new AdminService();

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const users = await adminService.getUsers({
      userId: searchParams.get("userId"),
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
    });
    return jsonOk({ users });
  } catch (error) {
    return jsonError(
      getErrorMessage(error, "Unable to fetch users."),
      getAdminErrorStatus(error) ?? 400,
    );
  }
}
