import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

type EndpointStats = {
  count: number;
  failures: number;
  totalMs: number;
  maxMs: number;
};

type RequestResult<T extends Json = Json> = {
  payload: T;
  status: number;
  elapsedMs: number;
};

type QueueResponse = {
  queue?: {
    status?: string;
    queueEntryId?: string | null;
    activeMatch?: {
      matchId: string;
      sessionId: string;
      status: string;
    } | null;
    recentMatch?: {
      matchId: string;
      sessionId: string;
      status: string;
    } | null;
  };
};

type SessionResponse = {
  session?: {
    userId?: string;
  };
};

type StressSummary = {
  usersSimulated: number;
  sessionsCreated: number;
  queueJoins: number;
  matchesCreated: number;
  successfulEndFindNextLoops: number;
  reportsSubmitted: number;
  blocksSubmitted: number;
  feedbackSubmitted: number;
  duplicateActiveQueueUsers: number;
  selfMatches: number;
  blockedRematches: number;
  stuckQueueCount: number;
  stuckMatchCount: number;
};

const envFiles = [".env.local", ".env"];

for (const file of envFiles) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) {
    continue;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");

    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

const baseUrl = (process.env.STRESS_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const userCount = Math.min(100, Math.max(2, Number(process.env.STRESS_USERS ?? 10)));
const allowStress = process.env.ALLOW_STRESS_TEST === "true";
const allowRemote = process.env.ALLOW_REMOTE_STRESS_TEST === "true";
const stats = new Map<string, EndpointStats>();
const failuresByEndpoint = new Map<string, number>();

function assertSafeTarget() {
  if (!allowStress) {
    throw new Error("Set ALLOW_STRESS_TEST=true before running synthetic stress tests.");
  }

  const url = new URL(baseUrl);
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (!isLocalhost && !allowRemote) {
    throw new Error("Remote stress tests require ALLOW_REMOTE_STRESS_TEST=true. Never point this at production.");
  }

  if (/echotalk\.live$/i.test(url.hostname) && !/staging|preview|vercel/i.test(url.hostname)) {
    throw new Error("Refusing to run against the public production domain.");
  }
}

function record(endpoint: string, elapsedMs: number, failed: boolean) {
  const current = stats.get(endpoint) ?? {
    count: 0,
    failures: 0,
    totalMs: 0,
    maxMs: 0,
  };

  current.count += 1;
  current.totalMs += elapsedMs;
  current.maxMs = Math.max(current.maxMs, elapsedMs);

  if (failed) {
    current.failures += 1;
    failuresByEndpoint.set(endpoint, (failuresByEndpoint.get(endpoint) ?? 0) + 1);
  }

  stats.set(endpoint, current);
}

function mergeSetCookie(existingCookie: string, response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookieValues = headers.getSetCookie?.() ?? [];
  const fallback = response.headers.get("set-cookie");
  const cookieValues = setCookieValues.length > 0 ? setCookieValues : fallback ? [fallback] : [];

  if (cookieValues.length === 0) {
    return existingCookie;
  }

  const cookieMap = new Map<string, string>();

  for (const cookie of existingCookie.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (name && valueParts.length > 0) {
      cookieMap.set(name, valueParts.join("="));
    }
  }

  for (const rawCookie of cookieValues) {
    const [pair] = rawCookie.split(";");
    const [name, ...valueParts] = pair.trim().split("=");

    if (name && valueParts.length > 0) {
      cookieMap.set(name, valueParts.join("="));
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

class SyntheticClient {
  cookie = "";
  userId: string | null = null;
  activeMatchId: string | null = null;

  constructor(readonly index: number) {}

  async request<T extends Json = Json>(
    path: string,
    init: RequestInit = {},
  ): Promise<RequestResult<T>> {
    const method = init.method ?? "GET";
    const endpoint = `${method} ${path}`;
    const startedAt = Date.now();
    const headers = new Headers(init.headers);

    headers.set("Accept", "application/json");
    headers.set("User-Agent", `echotalk-synthetic-beta/${this.index}`);
    headers.set("X-Forwarded-For", `10.44.0.${this.index}`);

    if (this.cookie) {
      headers.set("Cookie", this.cookie);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    const elapsedMs = Date.now() - startedAt;

    this.cookie = mergeSetCookie(this.cookie, response);

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? ((await response.json()) as T & { error?: string })
      : ({ error: await response.text() } as T & { error?: string });

    record(endpoint, elapsedMs, !response.ok);

    if (!response.ok) {
      throw new Error(`${endpoint} failed with ${response.status}: ${payload.error ?? "Unknown error"}`);
    }

    return {
      payload,
      status: response.status,
      elapsedMs,
    };
  }

  async createSession() {
    const { payload } = await this.request<SessionResponse>("/api/session", {
      method: "POST",
    });

    this.userId = payload.session?.userId ?? null;

    if (!this.userId) {
      throw new Error("Session response did not include userId.");
    }
  }

  async onboard() {
    await this.request("/api/session/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageConfirmed: true }),
    });
  }

  async joinQueue() {
    const { payload } = await this.request<QueueResponse>("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredCountries: [], excludedCountries: [] }),
    });

    this.captureMatch(payload);
  }

  async getQueue() {
    const { payload } = await this.request<QueueResponse>("/api/queue");
    this.captureMatch(payload);
    return payload;
  }

  async getMatch() {
    const { payload } = await this.request<QueueResponse>("/api/match");
    this.captureMatch(payload);
    return payload;
  }

  async endMatch(findNext = true) {
    if (!this.activeMatchId) {
      return false;
    }

    const endedMatchId = this.activeMatchId;
    const { payload } = await this.request<QueueResponse & { nextQueueError?: string }>("/api/match/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: endedMatchId,
        reason: findNext ? "end_find_next" : "synthetic_cleanup",
        findNext,
      }),
    });

    this.activeMatchId = null;
    this.captureMatch(payload);
    return !payload.nextQueueError;
  }

  async submitFeedback(matchId: string | null) {
    await this.request("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedbackType: "matching issue",
        feedbackText: "Synthetic beta readiness check.",
        matchId,
      }),
    });
  }

  async submitReport(matchId: string) {
    await this.request("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        reason: "spam/bot",
        details: "Synthetic beta readiness report.",
      }),
    });
    this.activeMatchId = null;
  }

  async submitBlock(matchId: string) {
    await this.request("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    });
    this.activeMatchId = null;
  }

  async leaveQueue() {
    await this.request<QueueResponse>("/api/queue", {
      method: "DELETE",
    }).catch(() => undefined);
  }

  private captureMatch(payload: QueueResponse) {
    const match = payload.queue?.activeMatch;

    if (match?.matchId) {
      this.activeMatchId = match.matchId;
    }
  }
}

async function inBatches<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(task));
  }
}

async function pollForMatches(clients: SyntheticClient[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  const seenMatches = new Set<string>();

  while (Date.now() < deadline) {
    await inBatches(clients, 10, async (client) => {
      await client.getQueue().catch((error) => {
        failuresByEndpoint.set("poll", (failuresByEndpoint.get("poll") ?? 0) + 1);
        console.warn(`poll failed for user ${client.index}:`, error instanceof Error ? error.message : error);
      });
    });

    for (const client of clients) {
      if (client.activeMatchId) {
        seenMatches.add(client.activeMatchId);
      }
    }

    if (seenMatches.size >= Math.floor(clients.length / 2)) {
      break;
    }

    await sleep(1_000);
  }

  return seenMatches;
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for invariant checks.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function checkInvariants(userIds: string[], knownMatchIds: string[]) {
  const supabase = getSupabaseAdminClient();
  const activeQueue = await supabase
    .from("queue_entries")
    .select("id, user_id")
    .in("user_id", userIds)
    .eq("status", "queued")
    .is("deleted_at", null);

  if (activeQueue.error) {
    throw activeQueue.error;
  }

  const activeMatches = await supabase
    .from("matches")
    .select("id, user_a_id, user_b_id, matched_at")
    .or(`user_a_id.in.(${userIds.join(",")}),user_b_id.in.(${userIds.join(",")})`)
    .eq("status", "matched");

  if (activeMatches.error) {
    throw activeMatches.error;
  }

  const blocks = await supabase
    .from("blocks")
    .select("blocker_user_id, blocked_user_id, created_at")
    .or(`blocker_user_id.in.(${userIds.join(",")}),blocked_user_id.in.(${userIds.join(",")})`);

  if (blocks.error) {
    throw blocks.error;
  }

  const pairBlocks = new Map<string, string>();

  for (const block of blocks.data ?? []) {
    const left = block.blocker_user_id as string;
    const right = block.blocked_user_id as string;
    pairBlocks.set([left, right].sort().join(":"), block.created_at as string);
  }

  const allKnownMatches = knownMatchIds.length > 0
    ? await supabase
        .from("matches")
        .select("id, user_a_id, user_b_id, matched_at")
        .in("id", knownMatchIds)
    : { data: [], error: null };

  if (allKnownMatches.error) {
    throw allKnownMatches.error;
  }

  const activeQueueByUser = new Map<string, number>();

  for (const entry of activeQueue.data ?? []) {
    const userId = entry.user_id as string;
    activeQueueByUser.set(userId, (activeQueueByUser.get(userId) ?? 0) + 1);
  }

  let blockedRematches = 0;

  for (const match of allKnownMatches.data ?? []) {
    const pairKey = [match.user_a_id as string, match.user_b_id as string].sort().join(":");
    const blockCreatedAt = pairBlocks.get(pairKey);

    if (blockCreatedAt && new Date(match.matched_at as string) > new Date(blockCreatedAt)) {
      blockedRematches += 1;
    }
  }

  return {
    stuckQueueCount: activeQueue.data?.length ?? 0,
    stuckMatchCount: activeMatches.data?.length ?? 0,
    duplicateActiveQueueUsers: Array.from(activeQueueByUser.values()).filter((count) => count > 1).length,
    selfMatches: (allKnownMatches.data ?? []).filter((match) => match.user_a_id === match.user_b_id).length,
    blockedRematches,
  };
}

function printSummary(summary: StressSummary) {
  const totalRequests = Array.from(stats.values()).reduce((total, stat) => total + stat.count, 0);
  const totalMs = Array.from(stats.values()).reduce((total, stat) => total + stat.totalMs, 0);
  const maxMs = Math.max(0, ...Array.from(stats.values()).map((stat) => stat.maxMs));
  const avgMs = totalRequests > 0 ? Math.round(totalMs / totalRequests) : 0;

  console.log("Synthetic beta API stress summary");
  console.log(`users simulated: ${summary.usersSimulated}`);
  console.log(`sessions created: ${summary.sessionsCreated}`);
  console.log(`queue joins: ${summary.queueJoins}`);
  console.log(`matches created: ${summary.matchesCreated}`);
  console.log(`successful end/find-next loops: ${summary.successfulEndFindNextLoops}`);
  console.log(`reports submitted: ${summary.reportsSubmitted}`);
  console.log(`blocks submitted: ${summary.blocksSubmitted}`);
  console.log(`feedback submitted: ${summary.feedbackSubmitted}`);
  console.log(`failures by endpoint: ${JSON.stringify(Object.fromEntries(failuresByEndpoint.entries()))}`);
  console.log(`average response time: ${avgMs}ms`);
  console.log(`max response time: ${maxMs}ms`);
  console.log(`stuck queue count: ${summary.stuckQueueCount}`);
  console.log(`stuck match count: ${summary.stuckMatchCount}`);
  console.log(`duplicate active queue users: ${summary.duplicateActiveQueueUsers}`);
  console.log(`self matches: ${summary.selfMatches}`);
  console.log(`blocked rematches: ${summary.blockedRematches}`);
}

async function main() {
  assertSafeTarget();

  const clients = Array.from({ length: userCount }, (_, index) => new SyntheticClient(index + 1));
  const knownMatches = new Set<string>();
  let sessionsCreated = 0;
  let queueJoins = 0;
  let successfulEndFindNextLoops = 0;
  let reportsSubmitted = 0;
  let blocksSubmitted = 0;
  let feedbackSubmitted = 0;

  await inBatches(clients, 10, async (client) => {
    await client.createSession();
    sessionsCreated += 1;
    await client.onboard();
  });

  await inBatches(clients, 10, async (client) => {
    await client.joinQueue();
    queueJoins += 1;
  });

  for (const matchId of await pollForMatches(clients, 45_000)) {
    knownMatches.add(matchId);
  }

  await sleep(5_500);

  const firstLoopMatches = Array.from(
    new Map(clients.filter((client) => client.activeMatchId).map((client) => [client.activeMatchId, client])).values(),
  );

  await inBatches(firstLoopMatches, 5, async (client) => {
    const endedAndRequeued = await client.endMatch(true);

    if (endedAndRequeued) {
      successfulEndFindNextLoops += 1;
    }
  });

  await sleep(5_500);

  await inBatches(clients, 10, async (client) => {
    try {
      const payload = await client.getQueue();

      if (payload.queue?.status === "idle") {
        await client.joinQueue();
        queueJoins += 1;
      }
    } catch (error) {
      failuresByEndpoint.set("requeue", (failuresByEndpoint.get("requeue") ?? 0) + 1);
    }
  });

  for (const matchId of await pollForMatches(clients, 45_000)) {
    knownMatches.add(matchId);
  }

  const feedbackClients = clients.slice(0, Math.min(3, clients.length));

  await inBatches(feedbackClients, 3, async (client) => {
    await client.submitFeedback(client.activeMatchId);
    feedbackSubmitted += 1;
  });

  const reportClient = clients.find((client) => client.activeMatchId);

  if (reportClient?.activeMatchId) {
    await reportClient.submitReport(reportClient.activeMatchId);
    reportsSubmitted += 1;
  }

  await sleep(1_000);

  const blockClient = clients.find((client) => client.activeMatchId);

  if (blockClient?.activeMatchId) {
    await blockClient.submitBlock(blockClient.activeMatchId);
    blocksSubmitted += 1;
  }

  await inBatches(clients, 10, async (client) => {
    await client.getMatch().catch(() => undefined);

    if (client.activeMatchId) {
      await client.endMatch(false).catch(() => undefined);
    }

    await client.leaveQueue();
  });

  const userIds = clients
    .map((client) => client.userId)
    .filter((userId): userId is string => Boolean(userId));
  const invariants = await checkInvariants(userIds, Array.from(knownMatches));
  const summary: StressSummary = {
    usersSimulated: userCount,
    sessionsCreated,
    queueJoins,
    matchesCreated: knownMatches.size,
    successfulEndFindNextLoops,
    reportsSubmitted,
    blocksSubmitted,
    feedbackSubmitted,
    ...invariants,
  };

  printSummary(summary);

  const criticalFailures = [
    sessionsCreated !== userCount,
    userCount >= 2 && knownMatches.size === 0,
    invariants.duplicateActiveQueueUsers > 0,
    invariants.selfMatches > 0,
    invariants.blockedRematches > 0,
    invariants.stuckMatchCount > 0,
  ];

  if (criticalFailures.some(Boolean)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
