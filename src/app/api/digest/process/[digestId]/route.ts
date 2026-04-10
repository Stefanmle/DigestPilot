import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import {
  getAuthenticatedClient,
  fetchNewEmails,
  fetchSentEmails,
} from "@/lib/gmail";
import { processDigestEmails, detectCommitments, checkCommitmentResolved } from "@/lib/ai";
import { matchReplies, getReplyPatterns } from "@/lib/reply-matcher";

export const maxDuration = 300; // 5 minutes for AI processing

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ digestId: string }> }
) {
  // Verify internal API key
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { digestId } = await params;
  const supabase = createAdminClient();

  try {
    // Get digest info
    const { data: digest } = await supabase
      .from("digests")
      .select("*")
      .eq("id", digestId)
      .single();

    if (!digest) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }

    // Mark as processing
    await supabase
      .from("digests")
      .update({ status: "processing" })
      .eq("id", digestId);

    // Get user's active inboxes
    const { data: inboxes } = await supabase
      .from("inboxes")
      .select("*")
      .eq("user_id", digest.user_id)
      .eq("is_active", true);

    if (!inboxes || inboxes.length === 0) {
      await supabase
        .from("digests")
        .update({
          status: "completed",
          email_count: 0,
          ai_cost_cents: 0,
        })
        .eq("id", digestId);
      return NextResponse.json({ message: "No active inboxes" });
    }

    let allEmails: any[] = [];
    let totalCostCents = 0;

    for (const inbox of inboxes) {
      try {
        const oauth2Client = await getAuthenticatedClient(inbox);

        // Step 1: Sent-folder scan (reply learning)
        const { sentMessages, newSentSyncCursor } = await fetchSentEmails(
          oauth2Client,
          inbox.sent_sync_cursor
        );

        if (sentMessages.length > 0) {
          await matchReplies(supabase, digest.user_id, sentMessages, inbox.id);

          // Step 1b: Detect commitments from sent emails
          try {
            const commitments = await detectCommitments(sentMessages);
            const defaultDue = new Date();
            defaultDue.setDate(defaultDue.getDate() + 3); // 3-day default

            for (const c of commitments) {
              await supabase.from("commitments").upsert({
                user_id: digest.user_id,
                thread_id: c.threadId,
                sent_email_external_id: c.emailId,
                to_name: c.toName,
                to_email: c.toEmail,
                title: c.title,
                description: c.description,
                commitment_type: c.type,
                due_at: c.dueAt || defaultDue.toISOString(),
                status: "pending",
              }, { onConflict: "user_id,thread_id,title" });
            }

            if (commitments.length > 0) {
              console.log(`Detected ${commitments.length} commitments from sent emails`);
            }
          } catch (err) {
            console.error("Commitment detection failed:", err);
          }
        }

        // Update sent sync cursor
        await supabase
          .from("inboxes")
          .update({ sent_sync_cursor: newSentSyncCursor })
          .eq("id", inbox.id);

        // Step 2: Fetch new inbox emails
        const { messages, newSyncCursor } = await fetchNewEmails(
          oauth2Client,
          inbox.sync_cursor,
          50 // Fetch up to 50 emails per digest
        );

        // Update sync cursor
        await supabase
          .from("inboxes")
          .update({
            sync_cursor: newSyncCursor,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", inbox.id);

        // Map messages with inbox reference
        for (const msg of messages) {
          allEmails.push({ ...msg, inboxId: inbox.id });
        }
      } catch (err: any) {
        // If token expired, mark inbox as inactive
        if (err?.code === 401 || err?.message?.includes("invalid_grant")) {
          await supabase
            .from("inboxes")
            .update({ is_active: false })
            .eq("id", inbox.id);
          console.error(`Inbox ${inbox.id} token expired, marked inactive`);
        } else {
          console.error(`Error processing inbox ${inbox.id}:`, err);
        }
      }
    }

    // Step 2.5: Auto-resolve commitments + mark overdue
    try {
      // Mark overdue commitments
      await supabase
        .from("commitments")
        .update({ status: "overdue" })
        .eq("user_id", digest.user_id)
        .eq("status", "pending")
        .lt("due_at", new Date().toISOString());

      // Check pending commitments for auto-resolve (simple: new sent email in same thread)
      const { data: pendingCommitments } = await supabase
        .from("commitments")
        .select("*")
        .eq("user_id", digest.user_id)
        .in("status", ["pending", "overdue"]);

      if (pendingCommitments && pendingCommitments.length > 0) {
        // Get all recent sent messages across all inboxes (already fetched above)
        // Check if any sent message is in a commitment's thread and was sent after the commitment
        for (const commitment of pendingCommitments) {
          const matchingSent = allEmails.filter(
            (e) => e.threadId === commitment.thread_id
          );
          if (matchingSent.length > 0) {
            // New activity in this thread — use AI to check if resolved
            const result = await checkCommitmentResolved(
              commitment,
              matchingSent.map((e) => ({
                from: e.from ?? "",
                to: e.fromEmail ?? "",
                subject: e.subject ?? "",
                body: e.body ?? "",
              }))
            );
            if (result.resolved) {
              await supabase
                .from("commitments")
                .update({
                  status: "auto_resolved",
                  resolved_at: new Date().toISOString(),
                  resolved_by: "auto",
                })
                .eq("id", commitment.id);
              console.log(`Auto-resolved commitment: ${commitment.title}`);
            }
          }
        }
      }
    } catch (err) {
      console.error("Commitment auto-resolve failed:", err);
    }

    // Step 2.6: Filter out blocked senders
    const { data: senderFilters } = await supabase
      .from("sender_filters")
      .select("email_address, email_domain, action")
      .eq("user_id", digest.user_id);

    const blockedEmails = new Set((senderFilters ?? []).map((f) => f.email_address?.toLowerCase()).filter(Boolean));
    const blockedDomains = new Set((senderFilters ?? []).map((f) => f.email_domain?.toLowerCase()).filter(Boolean));

    allEmails = allEmails.filter((e) => {
      const email = e.fromEmail?.toLowerCase() ?? "";
      const domain = email.split("@")[1] ?? "";
      return !blockedEmails.has(email) && !blockedDomains.has(domain);
    });

    // Step 3: AI processing
    if (allEmails.length > 0) {
      // Get reply patterns for few-shot learning
      const replyPatterns = await getReplyPatterns(supabase, digest.user_id);

      const { results, totalCostCents: cost } = await processDigestEmails(
        allEmails.map((e) => ({
          id: e.id,
          from: e.from,
          fromEmail: e.fromEmail,
          subject: e.subject,
          body: e.body,
          threadId: e.threadId,
        })),
        replyPatterns
      );

      totalCostCents = cost;

      // Store digest emails
      for (const result of results) {
        const originalEmail = allEmails.find((e) => e.id === result.emailId);

        await supabase.from("digest_emails").insert({
          digest_id: digestId,
          inbox_id: originalEmail?.inboxId,
          user_id: digest.user_id,
          external_id: result.emailId,
          thread_id: originalEmail?.threadId ?? "",
          from_name: originalEmail?.from,
          from_email: originalEmail?.fromEmail,
          subject: originalEmail?.subject,
          body_preview: originalEmail?.body?.slice(0, 4000),
          token_estimate: result.tokenEstimate,
          urgency: result.urgency,
          category: result.category,
          ai_summary: result.summary,
          suggested_reply: result.suggestedReply,
          recommended_action: result.recommendedAction,
          action_reason: result.actionReason,
          action_data: result.actionData,
        });
      }
    }

    // Step 4: Generate summary HTML
    const summaryHtml = `<p>${allEmails.length} emails processed</p>`;

    // Mark digest as completed
    await supabase
      .from("digests")
      .update({
        status: "completed",
        email_count: allEmails.length,
        ai_cost_cents: totalCostCents,
        summary_html: summaryHtml,
      })
      .eq("id", digestId);

    // Step 5: Send digest email
    try {
      const { data: user } = await supabase
        .from("users")
        .select("email")
        .eq("id", digest.user_id)
        .single();

      if (user?.email) {
        const { sendDigestEmail } = await import("@/lib/email-sender");

        const { data: digestEmailRows } = await supabase
          .from("digest_emails")
          .select("*")
          .eq("digest_id", digestId)
          .order("urgency", { ascending: true });

        // Fetch active commitments for the email
        const { data: activeCommitments } = await supabase
          .from("commitments")
          .select("*")
          .eq("user_id", digest.user_id)
          .in("status", ["pending", "overdue"])
          .order("due_at", { ascending: true });

        // Only send if there are emails OR commitments to report
        if ((digestEmailRows && digestEmailRows.length > 0) || (activeCommitments && activeCommitments.length > 0)) {
          await sendDigestEmail(user.email, digestEmailRows ?? [], digestId, activeCommitments ?? []);
        }

        await supabase
          .from("digests")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", digestId);
      }
    } catch (emailErr) {
      console.error("Failed to send digest email:", emailErr);
      // Don't fail the digest if email sending fails
    }

    return NextResponse.json({
      message: "Digest processed",
      emailCount: allEmails.length,
      costCents: totalCostCents,
    });
  } catch (err) {
    console.error(`Digest ${digestId} processing failed:`, err);

    await supabase
      .from("digests")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", digestId);

    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
