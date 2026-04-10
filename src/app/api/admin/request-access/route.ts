import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { SUPER_ADMIN } from "@/lib/allowlist";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  try {
    await resend.emails.send({
      from: "DigestPilot <digest@nokmi.site>",
      to: SUPER_ADMIN,
      subject: `DigestPilot: Access request from ${email}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; padding: 20px;">
          <h2 style="font-size: 18px;">New access request</h2>
          <p><strong>${email}</strong> wants to join DigestPilot.</p>
          <p style="margin-top: 16px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://digest-pilot.vercel.app"}/admin"
               style="background: #111; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open Admin Panel
            </a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send access request email:", err);
  }

  return NextResponse.json({ message: "Request sent" });
}
