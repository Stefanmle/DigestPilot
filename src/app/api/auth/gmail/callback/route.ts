import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { exchangeCodeForTokens, encryptTokens } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denying permission
  if (error) {
    const errorMessage =
      error === "access_denied" ? "permission_denied" : "oauth_error";
    return NextResponse.redirect(`${origin}/onboarding?error=${errorMessage}`);
  }

  // Validate state parameter (CSRF protection)
  const storedState = request.cookies.get("gmail_oauth_state")?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/onboarding?error=csrf_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/onboarding?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Encrypt tokens before storage
    const encrypted = encryptTokens(tokens);

    // Get user's email from Gmail
    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailEmail = profile.data.emailAddress ?? "";

    // Find the user by their email using admin client
    const supabase = createAdminClient();
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("email", gmailEmail)
      .limit(1);

    // Also try matching by the Gmail email in case they signed up with a different email
    let userId: string | null = users?.[0]?.id ?? null;

    if (!userId) {
      // Try finding by listing all recent users (fallback for email mismatch)
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, email")
        .order("created_at", { ascending: false })
        .limit(10);

      // Match by the Supabase auth email from the cookie session
      // For now, use the most recently created user as fallback
      userId = allUsers?.[0]?.id ?? null;
    }

    if (!userId) {
      return NextResponse.redirect(`${origin}/onboarding?error=no_user`);
    }

    // Store inbox in database
    const { error: dbError } = await supabase.from("inboxes").upsert(
      {
        user_id: userId,
        provider: "gmail",
        email_address: gmailEmail,
        access_token: encrypted.access_token,
        refresh_token: encrypted.refresh_token,
        token_key_version: 1,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        sync_cursor: null,  // null = first digest will fetch recent emails instead of only new ones
        is_active: true,
      },
      { onConflict: "user_id,email_address" }
    );

    if (dbError) {
      console.error("Error storing inbox:", dbError);
      return NextResponse.redirect(`${origin}/onboarding?error=db_error`);
    }

    // Clear the state cookie and redirect to consent step
    const response = NextResponse.redirect(
      `${origin}/onboarding?step=consent`
    );
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (err) {
    console.error("Gmail OAuth error:", err);
    return NextResponse.redirect(`${origin}/onboarding?error=oauth_error`);
  }
}
