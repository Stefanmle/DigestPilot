"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { AppLayout } from "@/components/app-layout";
import { EmailDetailContent } from "@/components/email-detail-content";

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [email, setEmail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmail();
  }, []);

  async function loadEmail() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data } = await supabase
      .from("digest_emails")
      .select("*")
      .eq("id", params.emailId)
      .eq("user_id", user.id)
      .single();

    if (!data) { router.push("/dashboard"); return; }
    setEmail(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout><EmailDetailContent email={email} /></AppLayout>;
}
