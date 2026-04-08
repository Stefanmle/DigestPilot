import { SupabaseClient } from "@supabase/supabase-js";

interface SentMessage {
  threadId: string;
  body: string;
}

interface DigestEmail {
  id: string;
  thread_id: string;
  subject: string | null;
  ai_summary: string | null;
  suggested_reply: string | null;
  user_reply: string | null;
}

/**
 * Match sent emails to digest emails and store reply patterns.
 * Uses thread_id as primary match, subject-line as fallback.
 */
export async function matchReplies(
  supabase: SupabaseClient,
  userId: string,
  sentMessages: SentMessage[],
  inboxId: string
): Promise<number> {
  if (sentMessages.length === 0) return 0;

  // Get unmatched digest emails for this inbox
  const { data: unmatchedEmails } = await supabase
    .from("digest_emails")
    .select("id, thread_id, subject, ai_summary, suggested_reply, user_reply")
    .eq("inbox_id", inboxId)
    .eq("user_id", userId)
    .is("user_reply", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!unmatchedEmails || unmatchedEmails.length === 0) return 0;

  let matchCount = 0;

  for (const sent of sentMessages) {
    // Primary match: thread_id
    let match = unmatchedEmails.find(
      (e) => e.thread_id === sent.threadId && !e.user_reply
    );

    // Fallback: subject-line matching
    if (!match) {
      const normalizedSubject = normalizeSubject(sent.body.split("\n")[0] ?? "");
      match = unmatchedEmails.find(
        (e) =>
          !e.user_reply &&
          e.subject &&
          normalizeSubject(e.subject) === normalizedSubject
      );
    }

    if (!match) continue;

    // Update digest_email with the actual reply
    await supabase
      .from("digest_emails")
      .update({
        user_reply: sent.body.slice(0, 4000),
        reply_matched_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    // Mark as matched in our local array
    match.user_reply = sent.body;

    // Detect if the reply was edited from our suggestion
    const wasEdited =
      match.suggested_reply !== null &&
      sent.body.trim() !== match.suggested_reply.trim();

    // Detect language (simple heuristic)
    const language = detectLanguage(sent.body);

    // Store reply pattern
    await supabase.from("reply_patterns").insert({
      user_id: userId,
      language,
      email_context_summary: match.ai_summary ?? "",
      ai_suggestion: match.suggested_reply ?? "",
      user_reply: sent.body.slice(0, 4000),
      was_edited: wasEdited,
    });

    matchCount++;
  }

  return matchCount;
}

/**
 * Get reply patterns for few-shot examples, filtered by language.
 */
export async function getReplyPatterns(
  supabase: SupabaseClient,
  userId: string,
  language?: string
): Promise<any[]> {
  let query = supabase
    .from("reply_patterns")
    .select("email_context_summary, ai_suggestion, user_reply, language")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (language) {
    // Try language-specific first
    const { data: langSpecific } = await query.eq("language", language).limit(10);
    if (langSpecific && langSpecific.length >= 3) {
      return langSpecific;
    }
  }

  // Fallback: all languages
  const { data } = await query.limit(10);
  return data ?? [];
}

function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re|Fwd|Fw|SV|VS|AW):\s*/gi, "")
    .trim()
    .toLowerCase();
}

function detectLanguage(text: string): string {
  // Simple heuristic: check for common Swedish words
  const swedishWords = [
    "hej",
    "tack",
    "och",
    "med",
    "det",
    "att",
    "som",
    "har",
    "jag",
    "kan",
    "ska",
    "mvh",
    "vänligen",
  ];
  const lower = text.toLowerCase();
  const swedishCount = swedishWords.filter((w) =>
    lower.includes(` ${w} `) || lower.startsWith(`${w} `)
  ).length;

  return swedishCount >= 2 ? "sv" : "en";
}
