import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending", "overdue"])
    .order("due_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
