import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { SUPER_ADMIN } from "@/lib/allowlist";

async function getSuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user?.email || user.email.toLowerCase() !== SUPER_ADMIN) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getSuperAdmin(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("allowlist")
    .select("email")
    .order("created_at", { ascending: true });

  return NextResponse.json({ emails: (data ?? []).map((d) => d.email) });
}

export async function POST(request: NextRequest) {
  const user = await getSuperAdmin(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await request.json();
  if (!email?.includes("@")) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("allowlist")
    .insert({ email: email.toLowerCase().trim(), added_by: user.id });

  if (error?.code === "23505") return NextResponse.json({ error: "Already exists" }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Added" }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getSuperAdmin(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await request.json();
  if (email === SUPER_ADMIN) return NextResponse.json({ error: "Cannot remove super admin" }, { status: 400 });

  const supabase = createAdminClient();
  await supabase.from("allowlist").delete().eq("email", email);
  return NextResponse.json({ message: "Removed" });
}
