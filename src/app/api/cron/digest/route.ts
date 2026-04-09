import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { findDueSchedules } from "@/lib/scheduler";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cronStarted = new Date();

  try {
    // 1. Get all active schedules with user timezones
    const { data: schedules } = await supabase
      .from("digest_schedules")
      .select("id, user_id, time, days, last_triggered_at, users(timezone)")
      .eq("is_active", true);

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ message: "No active schedules", digests: 0 });
    }

    // 2. Find which schedules are due now
    const dueSchedules = findDueSchedules(schedules as any);

    // 3. Also retry failed digests (up to 3 retries)
    const { data: failedDigests } = await supabase
      .from("digests")
      .select("id, user_id, schedule_id")
      .eq("status", "failed")
      .lt("retry_count", 3);

    // 4. Create queued digests for due schedules
    let digestsQueued = 0;
    const digestIds: string[] = [];

    for (const schedule of dueSchedules) {
      const { data: digest, error } = await supabase
        .from("digests")
        .insert({
          user_id: schedule.user_id,
          schedule_id: schedule.id,
          status: "queued",
        })
        .select("id")
        .single();

      if (digest && !error) {
        digestIds.push(digest.id);
        digestsQueued++;

        // Update last_triggered_at
        await supabase
          .from("digest_schedules")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", schedule.id);
      }
    }

    // Add failed digests for retry
    for (const failed of failedDigests ?? []) {
      await supabase
        .from("digests")
        .update({ status: "queued" })
        .eq("id", failed.id);
      digestIds.push(failed.id);
    }

    // 5. Fan out: trigger processing for each digest
    const requestHost = request.headers.get("host") ?? "";
    const protocol = requestHost.includes("localhost") ? "http" : "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${requestHost}`;
    for (const digestId of digestIds) {
      // Fire-and-forget — each runs in its own function invocation
      fetch(`${baseUrl}/api/digest/process/${digestId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
      }).catch(() => {
        // Ignore fetch errors — digest will be retried next cron run
      });
    }

    // 6. Log cron run
    await supabase.from("cron_runs").insert({
      started_at: cronStarted.toISOString(),
      completed_at: new Date().toISOString(),
      users_evaluated: schedules.length,
      digests_queued: digestsQueued + (failedDigests?.length ?? 0),
    });

    return NextResponse.json({
      message: "Cron completed",
      schedulesEvaluated: schedules.length,
      digestsQueued: digestsQueued + (failedDigests?.length ?? 0),
    });
  } catch (err) {
    console.error("Cron error:", err);

    await supabase.from("cron_runs").insert({
      started_at: cronStarted.toISOString(),
      completed_at: new Date().toISOString(),
      error_message: err instanceof Error ? err.message : "Unknown error",
    });

    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
