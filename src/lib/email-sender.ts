import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface DigestEmailRow {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  urgency: "low" | "medium" | "high" | null;
  ai_summary: string | null;
  suggested_reply: string | null;
}

export async function sendDigestEmail(
  to: string,
  emails: DigestEmailRow[],
  digestId: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const urgentCount = emails.filter((e) => e.urgency === "high").length;

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
      const replyUrl = email.suggested_reply
        ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email.from_email ?? "")}&su=${encodeURIComponent(`Re: ${email.subject ?? ""}`)}&body=${encodeURIComponent(email.suggested_reply.slice(0, 1500))}`
        : null;
      const editUrl = `${appUrl}/dashboard/${email.id}`;
      const replyTooLong =
        email.suggested_reply && email.suggested_reply.length > 1500;

      return `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="font-size: 14px; font-weight: 600; color: #111;">
          ${dot} ${escapeHtml(email.from_name || email.from_email || "Unknown")}
        </div>
        <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">
          ${escapeHtml(email.subject ?? "(no subject)")}
        </div>
        <div style="font-size: 14px; color: #374151; margin-top: 8px; line-height: 1.5;">
          ${escapeHtml(email.ai_summary ?? "")}
        </div>
        ${
          email.suggested_reply
            ? `
        <div style="background: #f3f4f6; border-radius: 6px; padding: 12px; margin-top: 10px; font-size: 13px; color: #374151; line-height: 1.5;">
          <strong style="color: #6b7280; font-size: 12px;">Suggested reply:</strong><br/>
          ${escapeHtml(email.suggested_reply)}
        </div>
        <div style="margin-top: 10px;">
          ${
            replyUrl && !replyTooLong
              ? `<a href="${replyUrl}" style="display: inline-block; background: #111; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500; margin-right: 8px;" target="_blank">Reply with this &rarr;</a>`
              : ""
          }
          <a href="${editUrl}" style="display: inline-block; background: #fff; color: #111; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid #d1d5db;" target="_blank">Edit &amp; reply &rarr;</a>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f9fafb;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px;">
    <h1 style="font-size: 18px; font-weight: 700; color: #111; margin: 0 0 4px;">
      DigestPilot — ${emails.length} new message${emails.length !== 1 ? "s" : ""}
    </h1>
    <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px;">
      ${emails.length} emails${urgentCount > 0 ? `, ${urgentCount} urgent` : ""} &bull; ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
    </p>
    ${emailCards}
    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <a href="${appUrl}/dashboard" style="color: #6b7280; font-size: 13px; text-decoration: underline;">Open full dashboard</a>
      &nbsp;&bull;&nbsp;
      <a href="${appUrl}/settings" style="color: #6b7280; font-size: 13px; text-decoration: underline;">Change schedule</a>
    </div>
  </div>
</body>
</html>`;

  // Plain text fallback
  const text = sorted
    .map(
      (e) =>
        `${e.urgency === "high" ? "[URGENT] " : ""}${e.from_name || e.from_email}: ${e.subject}\n${e.ai_summary}\n${e.suggested_reply ? `Suggested reply: ${e.suggested_reply}\n` : ""}`
    )
    .join("\n---\n");

  await resend.emails.send({
    from: "DigestPilot <digest@digestpilot.com>",
    to,
    subject: `DigestPilot: ${emails.length} new message${emails.length !== 1 ? "s" : ""}${urgentCount > 0 ? ` (${urgentCount} urgent)` : ""}`,
    html,
    text,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}
