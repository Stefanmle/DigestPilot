import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { exchangeCodeForTokens, encryptTokens } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denying permission
  if (error) {
    const errorMessage =
      error === "access_denied"
        ? "permission_denied"
        : "oauth_error";
    return NextResponse.redirect(
      `${origin}/onboarding?error=${errorMessage}`
    );
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/?error=auth`);
    }

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
    const gmailEmail = profile.data.emailAddress ?? user.email ?? "";

    // Store inbox in database
    const { error: dbError } = await supabase.from("inboxes").upsert(
      {
        user_id: user.id,
        provider: "gmail",
        email_address: gmailEmail,
        access_token: encrypted.access_token,
        refresh_token: encrypted.refresh_token,
        token_key_version: 1,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        sync_cursor: profile.data.historyId,
        is_active: true,
      },
      { onConflict: "user_id,email_address" }
    );

    if (dbError) {
      console.error("Error storing inbox:", dbError);
      return NextResponse.redirect(`${origin}/onboarding?error=db_error`);
    }

    // Clear the state cookie
    const response = NextResponse.redirect(`${origin}/onboarding?step=consent`);
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (err) {
    console.error("Gmail OAuth error:", err);
    return NextResponse.redirect(`${origin}/onboarding?error=oauth_error`);
  }
}
