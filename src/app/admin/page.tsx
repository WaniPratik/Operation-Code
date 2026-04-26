import { AdminAccessPage } from "@/features/admin/admin-access-page";
import { AdminPlaceholderPage } from "@/features/admin/admin-placeholder-page";
import { isAdminAccessConfigured, isAdminSessionAuthorized } from "@/server/auth/admin-session";

export default async function AdminRoute() {
  if (!isAdminAccessConfigured()) {
    return (
      <AdminAccessPage configurationError="Admin access is not configured yet. Add ADMIN_ACCESS_PASSWORD to .env.local before using /admin." />
    );
  }

  const authorized = await isAdminSessionAuthorized();

  if (!authorized) {
    return <AdminAccessPage />;
  }

  return <AdminPlaceholderPage />;
}
