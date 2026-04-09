"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/app-layout";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const sb = createBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) { router.push("/"); return; }
    setUser(session.user);

    const { data: profile } = await sb.from("users").select("*").eq("id", session.user.id).single();
    setUserProfile(profile);

    const res = await fetch("/api/schedules", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  }

  async function handleDeleteSchedule(id: string) {
    const sb = createBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    await fetch(`/api/schedules?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setSchedules(schedules.filter((s) => s.id !== id));
  }

  async function handleWithdrawConsent() {
    if (!confirm("This will disconnect all your inboxes and stop digest generation. Continue?")) return;
    const sb = createBrowserClient();
    await sb.from("users").update({ consent_given_at: null, consent_version: null }).eq("id", user.id);
    await sb.from("inboxes").update({ is_active: false }).eq("user_id", user.id);
    loadData();
  }

  async function handleDeleteAccount() {
    if (!confirm("This will permanently delete all your data. This cannot be undone.")) return;
    if (!confirm("Are you sure? All digests, inboxes, and reply patterns will be deleted.")) return;
    const sb = createBrowserClient();
    await sb.from("users").delete().eq("id", user.id);
    await sb.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <AppLayout><div className="flex flex-1 items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-8 py-5 lg:py-6 max-w-3xl space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>

        {/* Account */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{userProfile?.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Timezone</span>
                <span className="font-medium">{userProfile?.timezone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consent</span>
                <span className="font-medium">{userProfile?.consent_given_at
                  ? new Date(userProfile.consent_given_at).toLocaleDateString()
                  : "Not given"
                }</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Digest Schedules */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Digest schedule</h3>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">No schedules set.</p>
            ) : (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{s.label || `Daily at ${s.time}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.days.map((d: number) => DAY_NAMES[d]).join(", ")} at {s.time}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-8" onClick={() => handleDeleteSchedule(s.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={() => router.push("/onboarding?step=schedule")}>
              Add schedule
            </Button>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Privacy</h3>
            <Button variant="outline" className="w-full justify-start text-sm rounded-xl" onClick={handleWithdrawConsent}>
              Stop processing my emails
            </Button>
            <p className="text-xs text-muted-foreground">
              Disconnects inboxes and stops digest generation. Historical data is preserved.
            </p>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/20">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-destructive/60 font-medium">Danger zone</h3>
            <Button variant="destructive" className="w-full text-sm rounded-xl" onClick={handleDeleteAccount}>
              Delete my account
            </Button>
            <p className="text-xs text-muted-foreground">
              Permanently deletes all data. This cannot be undone.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
