"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { DashboardContent } from "@/components/dashboard-content";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [digests, setDigests] = useState<any[]>([]);
  const [digestEmails, setDigestEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }
    setUser(user);

    // Fetch latest digests
    const { data: digestsData } = await supabase
      .from("digests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setDigests(digestsData ?? []);

    // Fetch emails for latest digest
    const latestDigest = digestsData?.[0];
    if (latestDigest) {
      const { data: emailsData } = await supabase
        .from("digest_emails")
        .select("*")
        .eq("digest_id", latestDigest.id)
        .order("urgency", { ascending: true });
      setDigestEmails(emailsData ?? []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardContent
      user={user}
      digests={digests}
      digestEmails={digestEmails}
    />
  );
}
