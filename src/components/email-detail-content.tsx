"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DigestEmail {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  body_preview: string | null;
  urgency: string | null;
  category: string | null;
  ai_summary: string | null;
  suggested_reply: string | null;
  user_reply: string | null;
  thread_id: string;
}

export function EmailDetailContent({ email }: { email: DigestEmail }) {
  const router = useRouter();
  const [replyText, setReplyText] = useState(email.suggested_reply ?? "");
  const [copied, setCopied] = useState(false);

  const replySubject = `Re: ${email.subject ?? ""}`;
  const gmailWebUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email.from_email ?? "")}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyText.slice(0, 1500))}`;
  const mailtoUrl = `mailto:${encodeURIComponent(email.from_email ?? "")}?subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyText.slice(0, 1500))}`;

  async function copyReply() {
    await navigator.clipboard.writeText(replyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Button size="sm" variant="ghost" onClick={() => router.push("/dashboard")}>
            ← Back
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {email.from_name || email.from_email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {email.subject}
            </p>
          </div>
          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
            email.urgency === "high" ? "bg-red-500" :
            email.urgency === "medium" ? "bg-amber-400" : "bg-zinc-300"
          }`} />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        {/* AI Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{email.ai_summary}</p>
          </CardContent>
        </Card>

        {/* Original email preview */}
        {email.body_preview && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Original email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {email.body_preview}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reply editor */}
        {(email.suggested_reply || email.category === "personal" || email.category === "work") && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Your reply
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full min-h-[140px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y leading-relaxed"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Edit the suggested reply or write your own..."
              />

              {email.user_reply && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  You already replied to this email
                </p>
              )}

              <div className="flex gap-2">
                <a href={mailtoUrl} className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  Reply in app
                </a>
                <a href={gmailWebUrl} target="_blank" rel="noopener" className="flex-1 inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                  Reply in web
                </a>
                <Button variant="ghost" className="shrink-0" onClick={copyReply}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
