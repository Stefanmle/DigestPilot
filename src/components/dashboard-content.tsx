"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailCard } from "@/components/email-card";
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
  const router = useRouter();
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

        if (digest?.status === "processing") {
          setDigestStatus("AI is reading and summarizing...");
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

      setTimeout(() => { clearInterval(pollInterval); if (digestingNow) { setDigestStatus(null); setDigestingNow(false); } }, 120000);
    } catch {
      setDigestStatus("Something went wrong. Try again.");
      setTimeout(() => { setDigestingNow(false); setDigestStatus(null); }, 3000);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
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

  const urgentCount = currentEmails.filter((e) => e.urgency === "high").length;
  const replyCount = currentEmails.filter((e) => e.suggested_reply).length;

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              D
            </div>
            <h1 className="text-lg font-semibold">DigestPilot</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleDigestNow}
              disabled={digestingNow}
              className="relative"
            >
              {digestingNow && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              )}
              {digestingNow ? "Processing..." : "Digest now"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        {/* Processing status — shown above existing content */}
        {digestingNow && digestStatus && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full shrink-0" />
                <p className="text-sm font-medium">{digestStatus}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Digest summary */}
        {latestDigest ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {latestDigest.status === "completed"
                    ? `${latestDigest.email_count ?? 0} emails`
                    : latestDigest.status === "processing"
                      ? "Processing..."
                      : latestDigest.status === "failed"
                        ? "Digest failed"
                        : "Queued"}
                </CardTitle>
                {latestDigest.status === "completed" && (
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {urgentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {urgentCount} urgent
                      </span>
                    )}
                    {replyCount > 0 && (
                      <span>{replyCount} replies suggested</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(latestDigest.created_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <div className="text-4xl mb-2">📬</div>
              <p className="font-medium">No digests yet</p>
              <p className="text-sm text-muted-foreground">
                Tap "Digest now" to generate your first one.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Email list */}
        {sortedEmails.length > 0 && (
          <div className="space-y-3">
            {sortedEmails.map((email) => (
              <EmailCard key={email.id} email={email} onBlock={handleBlockSender} />
            ))}
          </div>
        )}

        {/* Digest history */}
        {currentDigests.length > 1 && (
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Past digests
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {currentDigests.map((d, i) => (
                <Button
                  key={d.id}
                  size="sm"
                  variant={i === selectedDigestIndex ? "default" : "outline"}
                  onClick={() => selectDigest(i)}
                  className="whitespace-nowrap text-xs"
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
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="flex justify-around py-2 max-w-2xl mx-auto">
          <NavButton icon="mail" label="Dashboard" active onClick={() => {}} />
          <NavButton icon="inbox" label="Inboxes" onClick={() => router.push("/inboxes")} />
          <NavButton icon="settings" label="Settings" onClick={() => router.push("/settings")} />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick: () => void }) {
  const iconColor = active ? "text-primary" : "text-muted-foreground";
  const labelColor = active ? "text-primary font-medium" : "text-muted-foreground";

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 py-1.5 px-4">
      <span className={`h-5 w-5 ${iconColor}`}>
        {icon === "mail" && <MailIcon />}
        {icon === "inbox" && <InboxIcon />}
        {icon === "settings" && <SettingsIcon />}
      </span>
      <span className={`text-[11px] ${labelColor}`}>{label}</span>
    </button>
  );
}

function MailIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
