import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { generateIcsContent } from "@/lib/calendar";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;
  const supabase = createAdminClient();

  const { data: email } = await supabase
    .from("digest_emails")
    .select("action_data, from_name, subject")
    .eq("id", emailId)
    .single();

  if (!email?.action_data?.start) {
    return NextResponse.json({ error: "No calendar event" }, { status: 404 });
  }

  const ics = generateIcsContent(email.action_data as any);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(email.action_data.title || "event")}.ics"`,
    },
  });
}
