"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Step = "connect" | "consent" | "schedule" | "preview";

const PRESETS = [
  { label: "Once daily at 14:00", time: "14:00", days: [0, 1, 2, 3, 4, 5, 6], desc: "Perfect for an afternoon overview" },
  { label: "Every morning at 08:00", time: "08:00", days: [0, 1, 2, 3, 4, 5, 6], desc: "Start your day informed" },
  { label: "Weekdays at 08:00", time: "08:00", days: [1, 2, 3, 4, 5], desc: "Skip weekends" },
  { label: "Twice daily", time: "08:00", days: [0, 1, 2, 3, 4, 5, 6], desc: "Morning + evening digests", extra: { time: "17:00", days: [0, 1, 2, 3, 4, 5, 6] } },
] as const;

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("connect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInbox, setHasInbox] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const errorParam = searchParams.get("error");

    if (errorParam === "permission_denied") setError("We need read access to your inbox to create digests. Please try again.");
    else if (errorParam === "oauth_error") setError("Something went wrong connecting your Gmail. Please try again.");
    else if (errorParam === "csrf_mismatch") setError("Security check failed. Please try again.");

    if (stepParam === "consent") { setStep("consent"); setHasInbox(true); }
    checkInbox();
    // Get user email
    createBrowserClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? null);
    });
  }, [searchParams]);

  async function checkInbox() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("inboxes").select("id").eq("user_id", user.id).limit(1);
    if (data && data.length > 0) {
      setHasInbox(true);
      if (step === "connect") setStep("consent");
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
    await supabase.from("users").update({ consent_given_at: new Date().toISOString(), consent_version: "v1.0" }).eq("id", user.id);
    setStep("schedule");
    setLoading(false);
  }

  async function handleSchedule(preset: typeof PRESETS[number]) {
    setLoading(true);
    const sb = createBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    };

    await fetch("/api/schedules", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ label: preset.label, time: preset.time, days: [...preset.days] }),
    });
    if ("extra" in preset && preset.extra) {
      await fetch("/api/schedules", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ label: "Evening digest", time: preset.extra.time, days: [...preset.extra.days] }),
      });
    }
    setStep("preview");
    await fetch("/api/digests/now", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setLoading(false);
  }

  const steps: Step[] = ["connect", "consent", "schedule", "preview"];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Progress */}
        <div className="flex justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 rounded-full transition-all duration-300 ${
              i <= currentStepIndex ? "bg-primary w-14" : "bg-muted w-10"
            }`} />
          ))}
        </div>

        <div className="text-center space-y-1">
          {userEmail && (
            <p className="text-xs text-muted-foreground">Signed in as {userEmail}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Step {currentStepIndex + 1} of 4
          </p>
        </div>

        {/* Step 1: Connect Gmail */}
        {step === "connect" && (
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="text-4xl mb-2">📧</div>
              <CardTitle className="text-xl">Connect your inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                DigestPilot reads your emails to create AI-powered summaries and suggest replies. We only need read access.
              </p>
              <Button className="w-full h-12 text-base" onClick={handleConnectGmail} disabled={loading}>
                {loading ? "Connecting..." : "Connect Gmail"}
              </Button>
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: GDPR Consent */}
        {step === "consent" && (
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="text-4xl mb-2">🔒</div>
              <CardTitle className="text-xl">Your data, your control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>To create your digest, we process your email content with AI. Here's what you should know:</p>
                <ul className="space-y-1.5 pl-1">
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span> We never store full email bodies</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span> Your data is encrypted at rest</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span> You can delete all data at any time</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span> You can withdraw consent in Settings</li>
                </ul>
              </div>
              <Button className="w-full h-12 text-base" onClick={handleConsent} disabled={loading}>
                I consent and want to continue
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => router.push("/")}>
                No thanks
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Schedule */}
        {step === "schedule" && (
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="text-4xl mb-2">⏰</div>
              <CardTitle className="text-xl">When do you want digests?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <p className="text-sm text-muted-foreground text-center mb-3">
                You can always change this later in Settings.
              </p>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className="w-full text-left rounded-lg border border-input p-3.5 hover:border-primary/50 hover:bg-accent/50 transition-colors"
                  onClick={() => handleSchedule(preset)}
                  disabled={loading}
                >
                  <p className="text-sm font-medium">{preset.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{preset.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && (
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="text-4xl mb-2">🎉</div>
              <CardTitle className="text-xl">You're all set!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Your first digest is being prepared. You'll also receive digest emails on your chosen schedule.
              </p>
              <Button className="w-full h-12 text-base" onClick={() => router.push("/dashboard")}>
                Go to dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
