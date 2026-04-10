"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { googleCalendarUrl } from "@/lib/calendar";

interface Commitment {
  id: string;
  to_name: string | null;
  to_email: string | null;
  title: string;
  description: string | null;
  commitment_type: string;
  due_at: string | null;
  status: string;
  created_at: string;
}

export function CommitmentsSection({ userId }: { userId: string }) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    loadCommitments();
  }, [userId]);

  async function loadCommitments() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/commitments", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setCommitments(await res.json());
    }
    setLoading(false);
  }

  async function markDone(id: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`/api/commitments/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setCommitments(commitments.filter((c) => c.id !== id));
  }

  if (loading || commitments.length === 0) return null;

  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);

  const overdue = commitments.filter((c) => c.status === "overdue" || (c.due_at && new Date(c.due_at) < now && c.status === "pending"));
  const today = commitments.filter((c) => c.due_at && new Date(c.due_at) >= now && new Date(c.due_at) <= todayEnd && c.status === "pending");
  const upcoming = commitments.filter((c) => c.due_at && new Date(c.due_at) > todayEnd && c.status === "pending");
  const noDue = commitments.filter((c) => !c.due_at && c.status === "pending");

  return (
    <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50/30 to-orange-50/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <h3 className="text-sm font-semibold">Your commitments</h3>
          <span className="text-xs text-muted-foreground">({commitments.length})</span>
        </div>

        {overdue.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-red-600 font-medium">Overdue</p>
            {overdue.map((c) => (
              <CommitmentCard key={c.id} commitment={c} onDone={markDone} variant="overdue" />
            ))}
          </div>
        )}

        {today.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-amber-600 font-medium">Today</p>
            {today.map((c) => (
              <CommitmentCard key={c.id} commitment={c} onDone={markDone} variant="today" />
            ))}
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Upcoming</p>
            {upcoming.map((c) => (
              <CommitmentCard key={c.id} commitment={c} onDone={markDone} variant="upcoming" />
            ))}
          </div>
        )}

        {noDue.length > 0 && (
          <div className="space-y-2">
            {noDue.map((c) => (
              <CommitmentCard key={c.id} commitment={c} onDone={markDone} variant="upcoming" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommitmentCard({
  commitment,
  onDone,
  variant,
}: {
  commitment: Commitment;
  onDone: (id: string) => void;
  variant: "overdue" | "today" | "upcoming";
}) {
  const typeIcon: Record<string, string> = {
    call: "📞",
    meeting: "🤝",
    deliver: "📦",
    follow_up: "🔄",
    reply: "💬",
  };

  const icon = typeIcon[commitment.commitment_type] || "📌";
  const borderColor = variant === "overdue" ? "border-l-red-500" : variant === "today" ? "border-l-amber-400" : "border-l-zinc-300";

  const calLink = commitment.due_at
    ? googleCalendarUrl({
        title: commitment.title,
        start: commitment.due_at,
        description: commitment.description || undefined,
      })
    : null;

  const dueLabel = commitment.due_at
    ? formatDue(commitment.due_at)
    : null;

  return (
    <div className={`flex items-start gap-3 bg-background rounded-xl p-3 border-l-2 ${borderColor}`}>
      <span className="text-sm mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{commitment.title}</p>
        {commitment.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{commitment.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {dueLabel && (
            <span className={`text-[11px] ${variant === "overdue" ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
              {dueLabel}
            </span>
          )}
          {commitment.to_name && (
            <span className="text-[11px] text-muted-foreground">→ {commitment.to_name}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {calLink && (
          <a
            href={calLink}
            target="_blank"
            rel="noopener"
            className="text-[11px] text-blue-600 hover:text-blue-700 transition-colors"
          >
            📅
          </a>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          onClick={() => onDone(commitment.id)}
        >
          ✓ Done
        </Button>
      </div>
    </div>
  );
}

function formatDue(due: string): string {
  const d = new Date(due);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 0) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
