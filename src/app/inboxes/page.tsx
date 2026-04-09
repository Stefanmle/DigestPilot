"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/app-layout";

export default function InboxesPage() {
  const router = useRouter();
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInboxes();
  }, []);

  async function loadInboxes() {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data } = await supabase
      .from("inboxes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setInboxes(data ?? []);
    setLoading(false);
  }

  if (loading) {
    return <AppLayout><div className="flex flex-1 items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-8 py-5 lg:py-6 max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Inboxes</h2>
          {inboxes.length > 0 && (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.location.href = "/api/auth/gmail"}>
              Add inbox
            </Button>
          )}
        </div>

        {inboxes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">No inboxes connected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your Gmail to start receiving AI-powered digests.
                </p>
              </div>
              <Button className="rounded-xl" onClick={() => router.push("/onboarding")}>
                Connect Gmail
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {inboxes.map((inbox) => (
              <Card key={inbox.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Provider icon */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100/50 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{inbox.email_address}</p>
                        {inbox.is_active ? (
                          <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium bg-red-50 text-red-600 ring-1 ring-red-200/60">
                            Reconnect needed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {inbox.provider}
                        {inbox.last_synced_at && (
                          <> &middot; Last synced {new Date(inbox.last_synced_at).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                  </div>

                  {!inbox.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full rounded-xl"
                      onClick={() => window.location.href = "/api/auth/gmail"}
                    >
                      Reconnect
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
