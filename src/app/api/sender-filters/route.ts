import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email_address, email_domain, action } = await request.json();

  if (!action || (!email_address && !email_domain)) {
    return NextResponse.json({ error: "email_address or email_domain and action required" }, { status: 400 });
  }

  const { data, error } = await supabase.from("sender_filters").upsert(
    {
      user_id: user.id,
      email_address: email_address ?? null,
      email_domain: email_domain ?? null,
      action,
    },
    { onConflict: email_address ? "user_id,email_address" : "user_id,email_domain" }
  ).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("sender_filters").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ message: "Deleted" });
}
