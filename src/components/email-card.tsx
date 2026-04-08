"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DigestEmail {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  urgency: "low" | "medium" | "high" | null;
  category: string | null;
  ai_summary: string | null;
  suggested_reply: string | null;
  thread_id: string;
}

const categoryBadge: Record<string, { label: string; className: string }> = {
  personal: { label: "Personal", className: "bg-blue-100 text-blue-700" },
  work: { label: "Work", className: "bg-purple-100 text-purple-700" },
  newsletter: { label: "Newsletter", className: "bg-gray-100 text-gray-600" },
  notification: { label: "Notification", className: "bg-gray-100 text-gray-600" },
  spam: { label: "Probable spam", className: "bg-red-100 text-red-600" },
  transactional: { label: "Receipt/Confirmation", className: "bg-green-100 text-green-700" },
};

export function EmailCard({ email }: { email: DigestEmail }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const urgencyDot = {
    high: "bg-red-500",
    medium: "bg-yellow-500",
    low: "bg-gray-400",
  };

  const hasReply = email.suggested_reply && email.suggested_reply.length > 0;
  const isLowPriority = ["newsletter", "notification", "spam", "transactional"].includes(email.category ?? "");

  const gmailComposeUrl = hasReply
    ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email.from_email ?? "")}&su=${encodeURIComponent(`Re: ${email.subject ?? ""}`)}&body=${encodeURIComponent(email.suggested_reply!.slice(0, 1500))}`
    : null;

  async function copyReply() {
    if (email.suggested_reply) {
      await navigator.clipboard.writeText(email.suggested_reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card className={isLowPriority ? "opacity-70" : ""}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${urgencyDot[email.urgency ?? "low"]}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">
                {email.from_name || email.from_email}
              </p>
              {email.category && categoryBadge[email.category] && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${categoryBadge[email.category].className}`}
                >
                  {categoryBadge[email.category].label}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {email.subject}
            </p>
          </div>
        </div>

        {/* AI Summary */}
        {email.ai_summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {email.ai_summary}
          </p>
        )}

        {/* Suggested Reply (expandable) — only for emails that need replies */}
        {hasReply && (
          <>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide reply" : "Show suggested reply"}
            </button>

            {expanded && (
              <div className="space-y-3">
                <div className="rounded-md bg-muted p-3 text-sm">
                  {email.suggested_reply}
                </div>

                <div className="flex gap-2">
                  {gmailComposeUrl && (
                    <a
                      href={gmailComposeUrl}
                      target="_blank"
                      rel="noopener"
                      className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Reply with this
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={copyReply}
                  >
                    {copied ? "Copied!" : "Copy reply"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
