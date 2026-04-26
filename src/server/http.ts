import { NextResponse } from "next/server";

interface ErrorWithMessage {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  statusCode?: number;
}

function isErrorLike(error: unknown): error is ErrorWithMessage {
  return typeof error === "object" && error !== null;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (!isErrorLike(error) || !error.message) {
    return fallback;
  }

  if (process.env.NODE_ENV === "production") {
    return error.message;
  }

  const extras = [
    error.code ? `code: ${error.code}` : null,
    error.details ? `details: ${error.details}` : null,
    error.hint ? `hint: ${error.hint}` : null,
  ].filter(Boolean);

  if (extras.length === 0) {
    return error.message;
  }

  return `${error.message} (${extras.join("; ")})`;
}

export function getErrorStatus(error: unknown, fallback = 400) {
  if (!isErrorLike(error) || typeof error.statusCode !== "number") {
    return fallback;
  }

  return error.statusCode;
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
