import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { env } from "@/server/env";

export const ADMIN_SESSION_COOKIE = "admin_session_token";

export class AdminAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createAdminSessionToken(password = env.adminAccessPassword) {
  return createHmac("sha256", password).update("admin-session-v1").digest("hex");
}

export function isAdminAccessConfigured() {
  return Boolean(process.env.ADMIN_ACCESS_PASSWORD);
}

export function getAdminErrorStatus(error: unknown) {
  return error instanceof AdminAccessError ? error.status : undefined;
}

export function verifyAdminPassword(password: string) {
  if (!isAdminAccessConfigured()) {
    throw new AdminAccessError(
      "Admin access is not configured. Set ADMIN_ACCESS_PASSWORD before using /admin.",
      500,
    );
  }

  return secureCompare(password, env.adminAccessPassword);
}

export async function isAdminSessionAuthorized() {
  if (!isAdminAccessConfigured()) {
    return false;
  }

  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? null;

  if (!token) {
    return false;
  }

  return secureCompare(token, createAdminSessionToken());
}

export async function requireAdminSession() {
  if (!isAdminAccessConfigured()) {
    throw new AdminAccessError(
      "Admin access is not configured. Set ADMIN_ACCESS_PASSWORD before using /admin.",
      500,
    );
  }

  if (!(await isAdminSessionAuthorized())) {
    throw new AdminAccessError("Admin authentication is required.", 401);
  }
}

export function applyAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), adminSessionCookieOptions());
  return response;
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
