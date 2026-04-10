"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RequestAccessPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const sb = createBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  async function handleSignOut() {
    const sb = createBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-white to-zinc-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardContent className="p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">Access required</h1>
            <p className="text-sm text-zinc-500 mt-2">
              DigestPilot is currently in private beta.
              {email && (
                <> You signed in as <strong className="text-zinc-700">{email}</strong>, but this account doesn't have access yet.</>
              )}
            </p>
          </div>

          {!requested ? (
            <Button
              className="w-full rounded-xl"
              onClick={() => setRequested(true)}
            >
              Request access
            </Button>
          ) : (
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700 font-medium">Request noted!</p>
              <p className="text-xs text-emerald-600 mt-1">We'll notify you when your access is approved.</p>
            </div>
          )}

          <Button variant="ghost" className="w-full text-xs text-zinc-400" onClick={handleSignOut}>
            Sign out and use a different account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
