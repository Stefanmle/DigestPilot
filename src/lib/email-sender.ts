import { Resend } from "resend";
import { googleCalendarUrl } from "./calendar";

const resend = new Resend(process.env.RESEND_API_KEY);

interface DigestEmailRow {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  urgency: "low" | "medium" | "high" | null;
  ai_summary: string | null;
  suggested_reply: string | null;
  recommended_action: string | null;
  action_reason: string | null;
  action_data: Record<string, any> | null;
}

export async function sendDigestEmail(
  to: string,
  emails: DigestEmailRow[],
  digestId: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const urgentCount = emails.filter((e) => e.urgency === "high").length;
  const calendarCount = emails.filter((e) => e.action_data?.start).length;

  const urgencyDot: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "⚪",
  };

  // Sort by urgency
  const sorted = [...emails].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.urgency ?? "low"] ?? 2) - (order[b.urgency ?? "low"] ?? 2);
  });

  // Build email cards HTML
  const emailCards = sorted
    .map((email) => {
      const dot = urgencyDot[email.urgency ?? "low"];
      const action = email.recommended_action ?? "archive";
      const replySubject = `Re: ${email.subject ?? ""}`;
      const replyBody = email.suggested_reply?.slice(0, 1500) ?? "";
      const gmailWebUrl = email.suggested_reply
        ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email.from_email ?? "")}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`
        : null;
      const mailtoUrl = email.suggested_reply
        ? `mailto:${encodeURIComponent(email.from_email ?? "")}?subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`
        : null;
      const editUrl = `${appUrl}/dashboard/${email.id}`;
      const replyTooLong =
        email.suggested_reply && email.suggested_reply.length > 1500;

      // Calendar link — show whenever event data exists, regardless of action
      const calLink = email.action_data?.start
        ? googleCalendarUrl(email.action_data as any)
        : null;

      // Action badge
      const actionBadge = getActionBadgeHtml(action, email.action_data, email.action_reason, email.from_email);

      // Unsubscribe link for newsletter emails
      const unsubGmailUrl = action === "unsubscribe" && email.from_email
        ? `https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(email.from_email)}+unsubscribe`
        : null;

      return `
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; ${action === "calendar" ? "border-left: 3px solid #3b82f6;" : action === "reply" ? "border-left: 3px solid #111;" : ""}">
        <div style="font-size: 14px; font-weight: 600; color: #111;">
          ${dot} ${escapeHtml(email.from_name || email.from_email || "Unknown")}
        </div>
        <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">
          ${escapeHtml(email.subject ?? "(no subject)")}
        </div>
        <div style="font-size: 14px; color: #374151; margin-top: 8px; line-height: 1.5;">
          ${escapeHtml(email.ai_summary ?? "")}
        </div>
        ${actionBadge}
        ${
          unsubGmailUrl
            ? `
        <div style="margin-top: 10px;">
          <a href="${unsubGmailUrl}" style="display: inline-block; background: #f3f4f6; color: #374151; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;" target="_blank">📭 Find unsubscribe link</a>
        </div>`
            : ""
        }
        ${
          calLink
            ? `
        <div style="margin-top: 12px;">
          <a href="${calLink}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;" target="_blank">📅 Add to calendar</a>
          ${email.action_data?.start ? `<span style="display: inline-block; margin-left: 10px; font-size: 12px; color: #6b7280; vertical-align: middle;">${formatEventTime(email.action_data.start, email.action_data.end)}</span>` : ""}
        </div>`
            : ""
        }
        ${
          email.suggested_reply
            ? `
        <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin-top: 10px; font-size: 13px; color: #374151; line-height: 1.5;">
          <strong style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Suggested reply:</strong><br/>
          ${escapeHtml(email.suggested_reply)}
        </div>
        <div style="margin-top: 10px;">
          ${
            mailtoUrl && !replyTooLong
              ? `<a href="${mailtoUrl}" style="display: inline-block; background: #111; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; margin-right: 8px;">Reply in app &rarr;</a>`
              : ""
          }
          ${
            gmailWebUrl && !replyTooLong
              ? `<a href="${gmailWebUrl}" style="display: inline-block; background: #fff; color: #111; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid #d1d5db; margin-right: 8px;" target="_blank">Reply in web &rarr;</a>`
              : ""
          }
          <a href="${editUrl}" style="display: inline-block; background: #fff; color: #111; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid #d1d5db;" target="_blank">Edit &amp; reply &rarr;</a>
        </div>`
            : ""
        }
      </div>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 16px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; width: 36px; height: 36px; background: #111; border-radius: 10px; color: #fff; font-weight: 700; font-size: 16px; line-height: 36px; text-align: center;">D</div>
    </div>
    <h1 style="font-size: 20px; font-weight: 700; color: #111; margin: 0 0 4px; text-align: center;">
      ${emails.length} new message${emails.length !== 1 ? "s" : ""}
    </h1>
    <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px; text-align: center;">
      ${urgentCount > 0 ? `${urgentCount} urgent · ` : ""}${calendarCount > 0 ? `${calendarCount} calendar event${calendarCount !== 1 ? "s" : ""} · ` : ""}${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
    </p>
    ${emailCards}
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <a href="${appUrl}/dashboard" style="display: inline-block; background: #111; color: #fff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; margin-bottom: 12px;">Open dashboard</a>
      <br/>
      <a href="${appUrl}/settings" style="color: #9ca3af; font-size: 12px; text-decoration: underline;">Change schedule</a>
    </div>
  </div>
</body>
</html>`;

  // Plain text fallback
  const text = sorted
    .map((e) => {
      let line = `${e.urgency === "high" ? "[URGENT] " : ""}${e.from_name || e.from_email}: ${e.subject}\n${e.ai_summary}`;
      if (e.recommended_action === "calendar" && e.action_data?.start) {
        line += `\n📅 Calendar event: ${e.action_data.title} at ${e.action_data.start}`;
      }
      if (e.suggested_reply) line += `\nSuggested reply: ${e.suggested_reply}`;
      return line;
    })
    .join("\n---\n");

  await resend.emails.send({
    from: "DigestPilot <onboarding@resend.dev>",
    to,
    subject: `DigestPilot: ${emails.length} new message${emails.length !== 1 ? "s" : ""}${urgentCount > 0 ? ` (${urgentCount} urgent)` : ""}${calendarCount > 0 ? ` 📅` : ""}`,
    html,
    text,
  });
}

function getActionBadgeHtml(action: string, actionData: Record<string, any> | null, actionReason: string | null, fromEmail: string | null): string {
  const reasonHtml = actionReason ? ` <span style="font-weight: 400; opacity: 0.8;">— ${escapeHtml(actionReason)}</span>` : '';
  const badges: Record<string, string> = {
    reply: `<span style="display: inline-block; background: #f3f4f6; color: #374151; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; margin-top: 8px;">💬 Reply suggested${reasonHtml}</span>`,
    calendar: `<span style="display: inline-block; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; margin-top: 8px;">📅 ${actionData?.title ? escapeHtml(actionData.title) : "Calendar event"}${reasonHtml}</span>`,
    follow_up: `<span style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; margin-top: 8px;">⏰ Follow up${reasonHtml}</span>`,
    spam: `<span style="display: inline-block; background: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; margin-top: 8px;">🚫 Spam${reasonHtml}</span>`,
    unsubscribe: `<span style="display: inline-block; background: #f3f4f6; color: #6b7280; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; margin-top: 8px;">📭 Unsubscribe${reasonHtml}</span>`,
    archive: actionReason ? `<span style="display: inline-block; color: #9ca3af; font-size: 11px; margin-top: 8px;">${escapeHtml(actionReason)}</span>` : '',
  };
  return badges[action] ?? '';
}

function formatEventTime(start: string, end?: string): string {
  const s = new Date(start);
  const dateStr = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = s.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (end) {
    const e = new Date(end);
    const endTime = e.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr}, ${timeStr} – ${endTime}`;
  }
  return `${dateStr}, ${timeStr}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}
