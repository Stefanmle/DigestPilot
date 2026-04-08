import { createAdminClient } from "./supabase";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter.
 * For production with multiple instances, use Redis or Supabase-backed counters.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check per-user daily AI cost against the $2/day cap.
 */
export async function checkDailyAiCostCap(
  userId: string
): Promise<{ allowed: boolean; totalCostCents: number }> {
  const supabase = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("digests")
    .select("ai_cost_cents")
    .eq("user_id", userId)
    .gte("created_at", today.toISOString())
    .eq("status", "completed");

  const totalCostCents = (data ?? []).reduce(
    (sum, d) => sum + (d.ai_cost_cents ?? 0),
    0
  );

  // $2/day = 200 cents
  return { allowed: totalCostCents < 200, totalCostCents };
}
