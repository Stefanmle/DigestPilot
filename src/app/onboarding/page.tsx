"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Step = "connect" | "consent" | "schedule" | "preview";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <OnboardingContent />
    </Suspense>
  );
}

const PRESETS = [
  { label: "Once daily (14:00)", time: "14:00", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Every morning (08:00)", time: "08:00", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays at 08:00", time: "08:00", days: [1, 2, 3, 4, 5] },
  { label: "Twice daily (08:00 + 17:00)", time: "08:00", days: [0, 1, 2, 3, 4, 5, 6], extra: { time: "17:00", days: [0, 1, 2, 3, 4, 5, 6] } },
] as const;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("connect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInbox, setHasInbox] = useState(false);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const errorParam = searchParams.get("error");

    if (errorParam === "permission_denied") {
      setError("We need read access to your inbox to create digests. Please try again.");
    } else if (errorParam === "oauth_error") {
      setError("Something went wrong connecting your Gmail. Please try again.");
    } else if (errorParam === "csrf_mismatch") {
      setError("Security check failed. Please try again.");
    }

    if (stepParam === "consent") {
      setStep("consent");
      setHasInbox(true);
    }

    // Check if user already has an inbox
    checkInbox();
  }, [searchParams]);

  async function checkInbox() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("inboxes")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (data && data.length > 0) {
      setHasInbox(true);
      if (step === "connect") {
        setStep("consent");
      }
    }
  }

  async function handleConnectGmail() {
    setLoading(true);
    setError(null);
    window.location.href = "/api/auth/gmail";
  }

  async function handleConsent() {
    setLoading(true);
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("users")
      .update({
        consent_given_at: new Date().toISOString(),
        consent_version: "v1.0",
      })
      .eq("id", user.id);

    setStep("schedule");
    setLoading(false);
  }

  async function handleSchedule(preset: typeof PRESETS[number]) {
    setLoading(true);

    // Create schedule(s)
    await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: preset.label,
        time: preset.time,
        days: [...preset.days],
      }),
    });

    // Create second schedule for "twice daily"
    if ("extra" in preset && preset.extra) {
      await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Evening digest",
          time: preset.extra.time,
          days: [...preset.extra.days],
        }),
      });
    }

    setStep("preview");

    // Trigger preview digest
    await fetch("/api/digests/now", { method: "POST" });
    setLoading(false);
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Progress */}
        <div className="flex justify-center gap-2">
          {(["connect", "consent", "schedule", "preview"] as Step[]).map(
            (s, i) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full ${
                  (["connect", "consent", "schedule", "preview"] as Step[]).indexOf(step) >= i
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            )
          )}
        </div>

        {/* Step 1: Connect Gmail */}
        {step === "connect" && (
          <Card>
            <CardHeader>
              <CardTitle>Connect your inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                DigestPilot reads your emails to create AI-powered summaries and
                suggest replies. We only need read access — we never send emails
                on your behalf.
              </p>
              <Button
                className="w-full h-11"
                onClick={handleConnectGmail}
                disabled={loading}
              >
                {loading ? "Connecting..." : "Connect Gmail"}
              </Button>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: GDPR Consent */}
        {step === "consent" && (
          <Card>
            <CardHeader>
              <CardTitle>Your data, your control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  To create your digest, we'll send your email content to our AI
                  provider (Anthropic) for summarization.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>We never store full email bodies — only AI-generated summaries</li>
                  <li>Your data is encrypted at rest</li>
                  <li>You can delete all your data at any time</li>
                  <li>You can withdraw consent in Settings</li>
                </ul>
              </div>
              <Button className="w-full h-11" onClick={handleConsent} disabled={loading}>
                I consent and want to continue
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.push("/")}
              >
                No thanks, disconnect my inbox
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Schedule */}
        {step === "schedule" && (
          <Card>
            <CardHeader>
              <CardTitle>When do you want your digests?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pick a schedule. You can change this anytime in Settings.
              </p>
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleSchedule(preset)}
                  disabled={loading}
                >
                  {preset.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && (
          <Card>
            <CardHeader>
              <CardTitle>You're all set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your first digest is being prepared now. You'll also receive
                digest emails on your chosen schedule.
              </p>
              <Button
                className="w-full h-11"
                onClick={() => router.push("/dashboard")}
              >
                Go to dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
