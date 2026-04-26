import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

export const GUEST_SESSION_COOKIE = "guest_session_token";

function guestSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export function createGuestSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashGuestSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function readGuestSessionTokenFromCookies() {
  return (await cookies()).get(GUEST_SESSION_COOKIE)?.value ?? null;
}

export async function writeGuestSessionCookie(token: string) {
  (await cookies()).set(GUEST_SESSION_COOKIE, token, guestSessionCookieOptions());
}

export function applyGuestSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(GUEST_SESSION_COOKIE, token, guestSessionCookieOptions());
  return response;
}
