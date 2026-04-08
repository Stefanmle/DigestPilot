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
  ai_summary: string | null;
  suggested_reply: string | null;
  thread_id: string;
}

export function EmailCard({ email }: { email: DigestEmail }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const urgencyDot = {
    high: "bg-red-500",
    medium: "bg-yellow-500",
    low: "bg-gray-400",
  };

  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email.from_email ?? "")}&su=${encodeURIComponent(`Re: ${email.subject ?? ""}`)}&body=${encodeURIComponent(email.suggested_reply ?? "")}`;

  async function copyReply() {
    if (email.suggested_reply) {
      await navigator.clipboard.writeText(email.suggested_reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${urgencyDot[email.urgency ?? "low"]}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {email.from_name || email.from_email}
            </p>
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

        {/* Suggested Reply (expandable) */}
        {email.suggested_reply && (
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
                  <a
                    href={gmailComposeUrl}
                    target="_blank"
                    rel="noopener"
                    className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Reply with this
                  </a>
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
