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

const categoryConfig: Record<string, { label: string; className: string }> = {
  personal: { label: "Personal", className: "bg-blue-50 text-blue-600 ring-1 ring-blue-200" },
  work: { label: "Work", className: "bg-violet-50 text-violet-600 ring-1 ring-violet-200" },
  newsletter: { label: "Newsletter", className: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200" },
  notification: { label: "Notification", className: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200" },
  spam: { label: "Spam", className: "bg-red-50 text-red-500 ring-1 ring-red-200" },
  transactional: { label: "Receipt", className: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" },
};

export function EmailCard({ email }: { email: DigestEmail }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasReply = email.suggested_reply && email.suggested_reply.length > 0;
  const isLowPriority = ["newsletter", "notification", "spam", "transactional"].includes(email.category ?? "");

  const replySubject = `Re: ${email.subject ?? ""}`;
  const replyBody = email.suggested_reply?.slice(0, 1500) ?? "";

  const gmailWebUrl = hasReply
    ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email.from_email ?? "")}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`
    : null;
  const mailtoUrl = hasReply
    ? `mailto:${encodeURIComponent(email.from_email ?? "")}?subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`
    : null;

  async function copyReply() {
    if (email.suggested_reply) {
      await navigator.clipboard.writeText(email.suggested_reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card className={`transition-opacity ${isLowPriority ? "opacity-60 hover:opacity-100" : ""}`}>
      <CardContent className="p-4 space-y-2.5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
            email.urgency === "high" ? "bg-red-500" :
            email.urgency === "medium" ? "bg-amber-400" : "bg-zinc-300"
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">
                {email.from_name || email.from_email}
              </p>
              {email.category && categoryConfig[email.category] && (
                <span className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium ${categoryConfig[email.category].className}`}>
                  {categoryConfig[email.category].label}
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground truncate mt-0.5">
              {email.subject}
            </p>
          </div>
        </div>

        {/* AI Summary */}
        {email.ai_summary && (
          <p className="text-[13px] text-foreground/80 leading-relaxed pl-5">
            {email.ai_summary}
          </p>
        )}

        {/* Suggested Reply */}
        {hasReply && (
          <div className="pl-5">
            <button
              type="button"
              className="text-[13px] font-medium text-primary hover:text-primary/80 transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide reply ↑" : "Show suggested reply ↓"}
            </button>

            {expanded && (
              <div className="mt-2.5 space-y-2.5">
                <div className="rounded-lg bg-muted/70 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {email.suggested_reply}
                </div>

                <div className="flex gap-2">
                  {mailtoUrl && (
                    <a href={mailtoUrl} className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                      Reply in app
                    </a>
                  )}
                  {gmailWebUrl && (
                    <a href={gmailWebUrl} target="_blank" rel="noopener" className="flex-1 inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-[13px] font-medium hover:bg-accent transition-colors">
                      Reply in web
                    </a>
                  )}
                  <Button size="sm" variant="ghost" className="shrink-0 text-[13px]" onClick={copyReply}>
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
