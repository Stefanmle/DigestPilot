"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/"); return; }
    setUser(user);

    const { data: profile } = await sb.from("users").select("*").eq("id", user.id).single();
    setUserProfile(profile);

    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch("/api/schedules", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  }

  async function handleDeleteSchedule(id: string) {
    const sb = createBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    await fetch(`/api/schedules?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
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

  async function handleSignOut() {
    const sb = createBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-8 py-6 max-w-3xl space-y-5">
        {/* Account */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        {/* Digest Schedules */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Digest schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No schedules set.</p>
            ) : (
              schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm font-medium">{s.label || `Daily at ${s.time}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.days.map((d: number) => DAY_NAMES[d]).join(", ")} at {s.time}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteSchedule(s.id)}>
                    Remove
                  </Button>
                </div>
              ))
            )}
            <Button size="sm" variant="outline" className="w-full" onClick={() => router.push("/onboarding?step=schedule")}>
              Add schedule
            </Button>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start text-sm" onClick={handleWithdrawConsent}>
              Stop processing my emails
            </Button>
            <p className="text-xs text-muted-foreground">
              Disconnects inboxes and stops digest generation. Historical data is preserved.
            </p>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-destructive/70 font-medium">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="destructive" className="w-full text-sm" onClick={handleDeleteAccount}>
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
