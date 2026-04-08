import { createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { EmailDetailContent } from "@/components/email-detail-content";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ emailId: string }>;
}) {
  const { emailId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: email } = await supabase
    .from("digest_emails")
    .select("*")
    .eq("id", emailId)
    .eq("user_id", user.id)
    .single();

  if (!email) redirect("/dashboard");

  return <EmailDetailContent email={email} />;
}
