import { AdminService } from "@/server/services/admin-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";
import { getAdminErrorStatus, requireAdminSession } from "@/server/auth/admin-session";

const adminService = new AdminService();

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const auditLogs = await adminService.getAuditLogs({
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
      userId: searchParams.get("userId"),
      type: searchParams.get("type"),
    });
    return jsonOk({ auditLogs });
  } catch (error) {
    return jsonError(
      getErrorMessage(error, "Unable to fetch audit logs."),
      getAdminErrorStatus(error) ?? 400,
    );
  }
}
