import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  return user;
}

// PATCH — mark commitment as done (from dashboard)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("commitments")
    .update({
      status: "done",
      resolved_at: new Date().toISOString(),
      resolved_by: "user",
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Marked as done" });
}

// GET — mark as done from email link (no auth required, uses commitment ID as token)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Verify commitment exists
  const { data: commitment } = await supabase
    .from("commitments")
    .select("id, title, status")
    .eq("id", id)
    .single();

  if (!commitment) {
    return new NextResponse(donePageHtml("Not found", "This commitment was not found."), {
      headers: { "Content-Type": "text/html" },
      status: 404,
    });
  }

  if (commitment.status === "done" || commitment.status === "auto_resolved") {
    return new NextResponse(donePageHtml("Already done", `"${commitment.title}" was already marked as done.`), {
      headers: { "Content-Type": "text/html" },
    });
  }

  await supabase
    .from("commitments")
    .update({
      status: "done",
      resolved_at: new Date().toISOString(),
      resolved_by: "user",
    })
    .eq("id", id);

  return new NextResponse(donePageHtml("Done!", `"${commitment.title}" marked as done.`), {
    headers: { "Content-Type": "text/html" },
  });
}

function donePageHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>DigestPilot — ${title}</title></head>
<body style="font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb;">
  <div style="text-align: center; padding: 40px;">
    <div style="width: 48px; height: 48px; background: #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
      <svg width="24" height="24" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
    </div>
    <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">${title}</h1>
    <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px;">${message}</p>
    <a href="/dashboard" style="background: #111; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open dashboard</a>
  </div>
</body>
</html>`;
}
