import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  // Generate state parameter for CSRF protection
  const state = randomBytes(32).toString("hex");
  const authUrl = getAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
