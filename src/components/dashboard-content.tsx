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
  const [selectedDigestIndex, setSelectedDigestIndex] = useState(0);
  const router = useRouter();
  const supabase = createBrowserClient();

  const latestDigest = digests[selectedDigestIndex];

  async function handleDigestNow() {
    setDigestingNow(true);
    try {
      const res = await fetch("/api/digests/now", { method: "POST" });
      if (res.ok) {
        // Poll for completion
        const checkInterval = setInterval(async () => {
          router.refresh();
        }, 3000);
        setTimeout(() => clearInterval(checkInterval), 60000);
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => setDigestingNow(false), 5000);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  const sortedEmails = [...digestEmails].sort(
    (a, b) =>
      (urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 2) -
      (urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 2)
  );

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto w-full">
          <h1 className="text-lg font-semibold">DigestPilot</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleDigestNow}
              disabled={digestingNow}
            >
              {digestingNow ? "Processing..." : "Digest now"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Digest summary */}
        {latestDigest ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {latestDigest.status === "completed"
                  ? `${latestDigest.email_count ?? 0} emails`
                  : latestDigest.status === "processing"
                    ? "Processing your digest..."
                    : latestDigest.status === "failed"
                      ? "Digest failed"
                      : "Digest queued"}
              </CardTitle>
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
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No digests yet. Connect your inbox and set up a schedule to get
                started.
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push("/onboarding")}
              >
                Get started
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Email list */}
        {sortedEmails.length > 0 && (
          <div className="space-y-3">
            {sortedEmails.map((email) => (
              <EmailCard key={email.id} email={email} />
            ))}
          </div>
        )}

        {/* Digest history */}
        {digests.length > 1 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Past digests
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {digests.map((d, i) => (
                <Button
                  key={d.id}
                  size="sm"
                  variant={i === selectedDigestIndex ? "default" : "outline"}
                  onClick={() => setSelectedDigestIndex(i)}
                  className="whitespace-nowrap"
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
      <nav className="sticky bottom-0 border-t bg-background">
        <div className="flex justify-around py-2 max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" className="flex-col h-auto py-1.5">
            <MailIcon className="h-5 w-5" />
            <span className="text-xs">Dashboard</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto py-1.5"
            onClick={() => router.push("/inboxes")}
          >
            <InboxIcon className="h-5 w-5" />
            <span className="text-xs">Inboxes</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto py-1.5"
            onClick={() => router.push("/settings")}
          >
            <SettingsIcon className="h-5 w-5" />
            <span className="text-xs">Settings</span>
          </Button>
        </div>
      </nav>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
      />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}
