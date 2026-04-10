"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/app-layout";
import { isSuperAdmin } from "@/lib/allowlist";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createBrowserClient();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || !isSuperAdmin(user.email)) {
      router.push("/dashboard");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    // Load users
    const { data: usersData } = await supabase
      .from("users")
      .select("id, email, name, created_at, consent_given_at")
      .order("created_at", { ascending: false });
    setUsers(usersData ?? []);

    // Load allowlist
    const res = await fetch("/api/admin/allowlist", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setAllowedEmails(data.emails ?? []);
    }

    setLoading(false);
  }

  async function addEmail() {
    if (!newEmail.includes("@")) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/admin/allowlist", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: newEmail.toLowerCase().trim() }),
    });
    setAllowedEmails([...allowedEmails, newEmail.toLowerCase().trim()]);
    setNewEmail("");
    setSaving(false);
  }

  async function removeEmail(email: string) {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/admin/allowlist", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    setAllowedEmails(allowedEmails.filter((e) => e !== email));
  }

  if (loading) {
    return <AppLayout><div className="flex flex-1 items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-8 py-5 lg:py-6 max-w-3xl space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">Admin panel</h2>

        {/* Allowlist */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Allowed users</h3>
            <div className="space-y-2">
              {allowedEmails.map((email) => (
                <div key={email} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{email}</span>
                    {email === "stefan.aberg84@gmail.com" && (
                      <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-medium ring-1 ring-violet-200/60">Admin</span>
                    )}
                  </div>
                  {email !== "stefan.aberg84@gmail.com" && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-7 text-xs" onClick={() => removeEmail(email)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="new-user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                className="h-9 rounded-xl"
              />
              <Button size="sm" className="rounded-xl px-4 shrink-0" onClick={addEmail} disabled={saving || !newEmail.includes("@")}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Registered users */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Registered users ({users.length})</h3>
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email} &middot; Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    allowedEmails.includes(user.email)
                      ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60"
                      : "bg-red-50 text-red-600 ring-1 ring-red-200/60"
                  }`}>
                    {allowedEmails.includes(user.email) ? "Approved" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
