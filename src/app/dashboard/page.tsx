import { createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Fetch latest digest
  const { data: digests } = await supabase
    .from("digests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Fetch emails for latest digest
  const latestDigest = digests?.[0];
  let digestEmails: any[] = [];

  if (latestDigest) {
    const { data } = await supabase
      .from("digest_emails")
      .select("*")
      .eq("digest_id", latestDigest.id)
      .order("urgency", { ascending: true });
    digestEmails = data ?? [];
  }

  return (
    <DashboardContent
      user={user}
      digests={digests ?? []}
      digestEmails={digestEmails}
    />
  );
}
