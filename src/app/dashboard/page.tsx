"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { DashboardContent } from "@/components/dashboard-content";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [digests, setDigests] = useState<any[]>([]);
  const [digestEmails, setDigestEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }
    setUser(user);

    const { data: digestsData } = await supabase
      .from("digests").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(10);
    setDigests(digestsData ?? []);

    const latestDigest = digestsData?.[0];
    if (latestDigest) {
      const { data: emailsData } = await supabase
        .from("digest_emails").select("*").eq("digest_id", latestDigest.id)
        .order("urgency", { ascending: true });
      setDigestEmails(emailsData ?? []);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Loading your digests...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <DashboardContent user={user} digests={digests} digestEmails={digestEmails} />
    </AppLayout>
  );
}
