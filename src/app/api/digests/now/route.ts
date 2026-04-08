import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { checkRateLimit, checkDailyAiCostCap } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Get user from Authorization header (Bearer token from client)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabase = createAdminClient();

  // Verify the token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 per user per hour
  const rateLimit = checkRateLimit(`digest-now:${user.id}`, 5, 3600000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Try again later.",
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
      { status: 429 }
    );
  }

  // Check daily AI cost cap
  const costCheck = await checkDailyAiCostCap(user.id);
  if (!costCheck.allowed) {
    return NextResponse.json(
      { error: "Daily AI cost limit reached. Scheduled digests will still run." },
      { status: 429 }
    );
  }

  // Check for already processing digest (idempotency)
  const { data: existing } = await supabase
    .from("digests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["queued", "processing"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({
      message: "A digest is already being processed",
      digestId: existing[0].id,
    });
  }

  // Create a new on-demand digest
  const { data: digest, error } = await supabase
    .from("digests")
    .insert({
      user_id: user.id,
      schedule_id: null,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !digest) {
    return NextResponse.json(
      { error: "Failed to create digest" },
      { status: 500 }
    );
  }

  // Fan out to process endpoint
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  fetch(`${baseUrl}/api/digest/process/${digest.id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
    },
  }).catch(() => {});

  return NextResponse.json({
    message: "Digest queued",
    digestId: digest.id,
    remaining: rateLimit.remaining,
  });
}
