"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  user_reply: string | null;
  reply_matched_at: string | null;
  thread_id: string;
}

const categoryConfig: Record<string, { label: string; className: string }> = {
  personal: { label: "Personal", className: "bg-blue-50 text-blue-600 ring-1 ring-blue-200/60" },
  work: { label: "Work", className: "bg-violet-50 text-violet-600 ring-1 ring-violet-200/60" },
  newsletter: { label: "Newsletter", className: "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/60" },
  notification: { label: "Notification", className: "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/60" },
  spam: { label: "Spam", className: "bg-red-50 text-red-500 ring-1 ring-red-200/60" },
  transactional: { label: "Receipt", className: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60" },
};

export function EmailCard({ email, onBlock }: { email: DigestEmail; onBlock?: (email: DigestEmail, action: string) => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const hasReply = email.suggested_reply && email.suggested_reply.length > 0;
  const isLowPriority = ["newsletter", "notification", "spam", "transactional"].includes(email.category ?? "");
  const wasReplied = !!email.user_reply || !!email.reply_matched_at;

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
    <Card className={`transition-all duration-200 hover:shadow-md group ${isLowPriority ? "opacity-50 hover:opacity-100" : ""} ${wasReplied ? "border-l-2 border-l-emerald-400" : ""}`}>
      <CardContent className="p-4 space-y-2">
        {/* Header — tappable to open detail */}
        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => router.push(`/dashboard/${email.id}`)}
        >
          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
            email.urgency === "high" ? "bg-red-500 shadow-sm shadow-red-200" :
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
              {wasReplied && (
                <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                  Replied
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground truncate mt-0.5">
              {email.subject}
            </p>
          </div>
          <svg className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 mt-1.5 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>

        {/* AI Summary */}
        {email.ai_summary && (
          <p className="text-[13px] text-foreground/70 leading-relaxed pl-5">
            {email.ai_summary}
          </p>
        )}

        {/* User's actual reply (if detected) */}
        {wasReplied && email.user_reply && (
          <div className="pl-5">
            <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3 text-[12px] text-emerald-800 leading-relaxed">
              <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium mb-1">Your reply</p>
              <p className="whitespace-pre-wrap">{email.user_reply.slice(0, 200)}{email.user_reply.length > 200 ? "..." : ""}</p>
            </div>
          </div>
        )}

        {/* Suggested Reply */}
        {hasReply && !wasReplied && (
          <div className="pl-5">
            <button
              type="button"
              className="text-[13px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {expanded ? "Hide reply" : "Show suggested reply"}
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {expanded && (
              <div className="mt-2.5 space-y-2.5 animate-in slide-in-from-top-1 duration-200">
                <div className="rounded-xl bg-muted/50 p-3 text-[13px] leading-relaxed whitespace-pre-wrap border border-border/50">
                  {email.suggested_reply}
                </div>

                <div className="flex gap-2">
                  {mailtoUrl && (
                    <a href={mailtoUrl} onClick={(e) => e.stopPropagation()} className="flex-1 inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                      Reply in app
                    </a>
                  )}
                  {gmailWebUrl && (
                    <a href={gmailWebUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="flex-1 inline-flex items-center justify-center rounded-xl border border-input bg-background px-3 py-2 text-[13px] font-medium hover:bg-accent transition-colors">
                      Reply in web
                    </a>
                  )}
                  <Button size="sm" variant="ghost" className="shrink-0 text-[13px]" onClick={(e) => { e.stopPropagation(); copyReply(); }}>
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Block / Spam actions — subtle, only on hover for desktop */}
        {!blocked ? (
          <div className="flex gap-3 pl-5 pt-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
            <button
              className="text-[11px] text-muted-foreground/70 hover:text-destructive transition-colors"
              onClick={(e) => { e.stopPropagation(); setBlocked(true); onBlock?.(email, "spam"); }}
            >
              Mark as spam
            </button>
            <button
              className="text-[11px] text-muted-foreground/70 hover:text-destructive transition-colors"
              onClick={(e) => { e.stopPropagation(); setBlocked(true); onBlock?.(email, "trash"); }}
            >
              Block sender
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-emerald-600 pl-5 pt-0.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
            Blocked — won't appear in future digests
          </p>
        )}
      </CardContent>
    </Card>
  );
}
