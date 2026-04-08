import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has completed onboarding (has any inboxes)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: inboxes } = await supabase
          .from("inboxes")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        const redirectTo =
          inboxes && inboxes.length > 0 ? "/dashboard" : "/onboarding";

        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";

        const response = isLocalEnv
          ? NextResponse.redirect(`${origin}${redirectTo}`)
          : NextResponse.redirect(
              `https://${forwardedHost ?? new URL(request.url).host}${redirectTo}`
            );

        // Forward the cookies from supabase auth
        request.cookies.getAll().forEach((cookie) => {
          response.cookies.set(cookie.name, cookie.value);
        });

        return response;
      }
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/?error=auth`);
}
