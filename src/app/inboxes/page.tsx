"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  function getStatusBadge(inbox: any) {
    if (!inbox.is_active) {
      return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Disconnected</span>;
    }
    if (inbox.token_expires_at && new Date(inbox.token_expires_at) < new Date()) {
      return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Token expired</span>;
    }
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Connected</span>;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <h1 className="text-lg font-semibold">Inboxes</h1>
          <Button size="sm" variant="ghost" onClick={() => router.push("/dashboard")}>
            Back
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        {inboxes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No inboxes connected yet.</p>
              <Button className="mt-4" onClick={() => router.push("/onboarding")}>
                Connect Gmail
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {inboxes.map((inbox) => (
              <Card key={inbox.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{inbox.email_address}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {inbox.provider}
                        {inbox.last_synced_at && (
                          <> &bull; Last synced {new Date(inbox.last_synced_at).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                    {getStatusBadge(inbox)}
                  </div>
                  {!inbox.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => window.location.href = "/api/auth/gmail"}
                    >
                      Reconnect
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" className="w-full" onClick={() => window.location.href = "/api/auth/gmail"}>
              Add another inbox
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
