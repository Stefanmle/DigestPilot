"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmailCard } from "@/components/email-card";
import { CommitmentsSection } from "@/components/commitments-section";
import type { User } from "@supabase/supabase-js";

interface DashboardContentProps {
  user: User;
  digests: any[];
  digestEmails: any[];
}

export function DashboardContent({
  user,
  digests,
  digestEmails,
}: DashboardContentProps) {
  const [digestingNow, setDigestingNow] = useState(false);
  const [digestStatus, setDigestStatus] = useState<string | null>(null);
  const [selectedDigestIndex, setSelectedDigestIndex] = useState(0);
  const [currentDigests, setCurrentDigests] = useState(digests);
  const [currentEmails, setCurrentEmails] = useState(digestEmails);
  const supabase = createBrowserClient();

  const latestDigest = currentDigests[selectedDigestIndex];

  async function loadEmailsForDigest(digestId: string) {
    const { data: emails } = await supabase
      .from("digest_emails")
      .select("*")
      .eq("digest_id", digestId)
      .order("urgency", { ascending: true });
    setCurrentEmails(emails ?? []);
  }

  async function selectDigest(index: number) {
    setSelectedDigestIndex(index);
    const digest = currentDigests[index];
    if (digest) await loadEmailsForDigest(digest.id);
  }

  async function handleDigestNow() {
    setDigestingNow(true);
    setDigestStatus("Connecting to your inbox...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/digests/now", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setDigestStatus(data.error ?? "Something went wrong");
        setTimeout(() => { setDigestingNow(false); setDigestStatus(null); }, 3000);
        return;
      }

      const { digestId } = await res.json();
      setDigestStatus("Fetching your emails...");

      const pollInterval = setInterval(async () => {
        const { data: digest } = await supabase
          .from("digests").select("*").eq("id", digestId).single();

        if (digest?.status === "processing" || digest?.status === "queued") {
          // Show live email count
          try {
            const { count } = await supabase
              .from("digest_emails")
              .select("*", { count: "exact", head: true })
              .eq("digest_id", digestId);
            if (count && count > 0) {
              setDigestStatus(`AI is reading and summarizing... ${count} email${count !== 1 ? "s" : ""} processed`);
            } else if (digest?.status === "processing") {
              setDigestStatus("AI is reading and summarizing...");
            } else {
              setDigestStatus("Connecting to your inbox...");
            }
          } catch {
            setDigestStatus(digest?.status === "processing" ? "AI is reading and summarizing..." : "Connecting to your inbox...");
          }
        } else if (digest?.status === "completed") {
          clearInterval(pollInterval);
          setDigestStatus(null);
          setDigestingNow(false);

          const { data: newDigests } = await supabase
            .from("digests").select("*").eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(10);
          setCurrentDigests(newDigests ?? []);
          setSelectedDigestIndex(0);

          if (newDigests?.[0]) {
            const { data: emails } = await supabase
              .from("digest_emails").select("*").eq("digest_id", newDigests[0].id)
              .order("urgency", { ascending: true });
            setCurrentEmails(emails ?? []);
          }
        } else if (digest?.status === "failed") {
          clearInterval(pollInterval);
          setDigestStatus("Something went wrong. Try again.");
          setTimeout(() => { setDigestingNow(false); setDigestStatus(null); }, 4000);
        }
      }, 2000);

      setTimeout(() => { clearInterval(pollInterval); if (digestingNow) { setDigestStatus("Taking longer than expected — refresh the page to check."); setTimeout(() => { setDigestingNow(false); setDigestStatus(null); }, 5000); } }, 300000);
    } catch {
      setDigestStatus("Something went wrong. Try again.");
      setTimeout(() => { setDigestingNow(false); setDigestStatus(null); }, 3000);
    }
  }

  async function handleBlockSender(email: any, action: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const domain = email.from_email?.split("@")[1];
    await fetch("/api/sender-filters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        email_address: action === "spam" ? email.from_email : null,
        email_domain: action === "trash" ? domain : null,
        action,
      }),
    });
  }

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  const sortedEmails = [...currentEmails].sort(
    (a, b) =>
      (urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 2) -
      (urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 2)
  );

  const [replyPatternCount, setReplyPatternCount] = useState(0);
  const [repliedCount, setRepliedCount] = useState(0);

  useEffect(() => {
    async function loadStats() {
      const { count: patternCount } = await supabase
        .from("reply_patterns")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setReplyPatternCount(patternCount ?? 0);

      const { count: replied } = await supabase
        .from("digest_emails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("user_reply", "is", null);
      setRepliedCount(replied ?? 0);
    }
    loadStats();
  }, [user.id]);

  const urgentCount = currentEmails.filter((e) => e.urgency === "high").length;
  const replyCount = currentEmails.filter((e) => e.suggested_reply).length;

  return (
    <div className="px-4 lg:px-8 py-5 lg:py-6 max-w-3xl space-y-4">
      {/* Header with digest info + action */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Your digest</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {latestDigest
              ? new Date(latestDigest.created_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "No digests yet"}
          </p>
        </div>
        <Button
          onClick={handleDigestNow}
          disabled={digestingNow}
          className="relative rounded-xl shadow-sm h-9 px-4 shrink-0 text-sm"
        >
          {digestingNow && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white/80"></span>
            </span>
          )}
          {digestingNow ? "Processing..." : "Digest now"}
        </Button>
      </div>

      {/* Processing status */}
      {digestingNow && digestStatus && (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full shrink-0" />
              <p className="text-sm font-medium">{digestStatus}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Digest summary stats */}
      {latestDigest && latestDigest.status === "completed" && sortedEmails.length > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">{latestDigest.email_count ?? sortedEmails.length} emails</span>
          {urgentCount > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {urgentCount} urgent
            </span>
          )}
          {replyCount > 0 && (
            <span className="text-muted-foreground">{replyCount} replies suggested</span>
          )}
        </div>
      )}

      {/* Empty state — hide when digesting */}
      {!latestDigest && !digestingNow && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <div>
              <p className="font-medium">No digests yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tap "Digest now" to generate your first email summary.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 0 emails state */}
      {latestDigest && latestDigest.status === "completed" && sortedEmails.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <p className="font-medium text-muted-foreground">No new emails since last digest</p>
            <p className="text-sm text-muted-foreground">Check back later or try a different time range.</p>
          </CardContent>
        </Card>
      )}

      {/* Commitments */}
      <CommitmentsSection userId={user.id} />

      {/* Email list */}
      {sortedEmails.length > 0 && (
        <div className="space-y-3">
          {sortedEmails.map((email) => (
            <EmailCard key={email.id} email={email} onBlock={handleBlockSender} />
          ))}
        </div>
      )}

      {/* AI Learning Stats */}
      {(replyPatternCount > 0 || repliedCount > 0) && (
        <Card className="bg-gradient-to-r from-violet-50/60 to-blue-50/60 border-violet-200/40">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">AI is learning your style</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {replyPatternCount} reply pattern{replyPatternCount !== 1 ? "s" : ""} learned
                  {repliedCount > 0 && ` from ${repliedCount} email${repliedCount !== 1 ? "s" : ""}`}
                  {replyPatternCount >= 10 ? " — suggestions are personalized" :
                   replyPatternCount >= 5 ? " — getting better" :
                   " — reply to more emails to improve suggestions"}
                </p>
              </div>
              {replyPatternCount >= 10 && (
                <div className="text-xs font-medium text-violet-600 bg-violet-100 px-2.5 py-1 rounded-full">
                  Active
                </div>
              )}
            </div>
            {replyPatternCount > 0 && replyPatternCount < 30 && (
              <div className="mt-3 ml-12">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-violet-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (replyPatternCount / 30) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{replyPatternCount}/30</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Digest history */}
      {currentDigests.length > 1 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Past digests
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {currentDigests.map((d, i) => (
              <Button
                key={d.id}
                size="sm"
                variant={i === selectedDigestIndex ? "default" : "outline"}
                onClick={() => selectDigest(i)}
                className="whitespace-nowrap text-xs rounded-lg shrink-0"
              >
                {new Date(d.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
