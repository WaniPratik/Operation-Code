export type ApiErrorKind =
  | "session_expired"
  | "admin_session_expired"
  | "unexpected_response"
  | "request_failed";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: ApiErrorKind,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function addEnvironmentHint(message: string, status: number) {
  if (status < 500) {
    return message;
  }

  return `${message} If this is local or staging, check the server logs for the failing route.`;
}

function isGuestSessionMessage(message: string) {
  return /guest session is required|guest session is invalid/i.test(message);
}

function isAdminSessionMessage(message: string) {
  return /admin authentication is required/i.test(message);
}

function normalizeUserFacingApiMessage(message: string) {
  if (/onboarding must be completed before joining the queue/i.test(message)) {
    return "Finish onboarding before joining the queue.";
  }

  if (/cannot join the queue while an active match exists/i.test(message)) {
    return "You already have an active match. Refresh this page to reopen it.";
  }

  if (/voice room is only available for an active match/i.test(message)) {
    return "The live session is no longer ready. Refresh this page or return to the queue.";
  }

  if (/user is not a participant in this match/i.test(message)) {
    return "This session is no longer available for your guest session. Refresh and try again.";
  }

  if (/permission denied for function end_match_transactional/i.test(message)) {
    return "We could not end this session. Try again, then refresh if it is still active.";
  }

  if (/duplicate key value violates unique constraint/i.test(message)) {
    return "We hit a temporary retry issue. Refresh and try again.";
  }

  return message;
}

export function isSessionExpiredError(error: unknown) {
  return error instanceof ApiRequestError && error.kind === "session_expired";
}

export function isAdminSessionExpiredError(error: unknown) {
  return error instanceof ApiRequestError && error.kind === "admin_session_expired";
}

export async function parseApiResponse<T>(response: Response, input: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJsonResponse = contentType.includes("application/json");

  if (!isJsonResponse) {
    const body = await response.text();
    const detail = /<!DOCTYPE|<html/i.test(body)
      ? "The server returned HTML instead of JSON."
      : body.trim().slice(0, 180) || "The server returned an unexpected response.";

    throw new ApiRequestError(
      addEnvironmentHint(`Request to ${input} failed with status ${response.status}. ${detail}`, response.status),
      response.status,
      "unexpected_response",
    );
  }

  const payload = (await response.json()) as { error?: string };

  if (!response.ok) {
    const message = payload.error ?? `Request to ${input} failed with status ${response.status}.`;

    if (response.status === 401 && isGuestSessionMessage(message)) {
      throw new ApiRequestError(
        "Your guest session expired or could not be verified. Start a fresh session to continue.",
        response.status,
        "session_expired",
      );
    }

    if (response.status === 401 && isAdminSessionMessage(message)) {
      throw new ApiRequestError(
        "Your admin session expired. Reload /admin and sign in again.",
        response.status,
        "admin_session_expired",
      );
    }

    throw new ApiRequestError(
      addEnvironmentHint(normalizeUserFacingApiMessage(message), response.status),
      response.status,
      "request_failed",
    );
  }

  return payload as T;
}

export async function apiGet<T>(input: string) {
  const response = await fetch(input, {
    credentials: "include",
    cache: "no-store",
  });

  return parseApiResponse<T>(response, input);
}

export async function apiPost<T>(input: string, body?: unknown) {
  const response = await fetch(input, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseApiResponse<T>(response, input);
}

export async function apiDelete<T>(input: string) {
  const response = await fetch(input, {
    method: "DELETE",
    credentials: "include",
  });

  return parseApiResponse<T>(response, input);
}

type BestEffortApiRequestOptions = {
  method: "POST" | "DELETE";
  body?: unknown;
};

export function sendBestEffortApiRequest(input: string, options: BestEffortApiRequestOptions) {
  const headers = options.body
    ? {
        "Content-Type": "application/json",
      }
    : undefined;

  void fetch(input, {
    method: options.method,
    credentials: "include",
    keepalive: true,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).catch(() => {
    // Best-effort cleanup should never interrupt the current page exit.
  });
}
