interface SentEmail {
  id: string;
  to: string;
  toEmail: string;
  subject: string;
  body: string;
  threadId: string;
}

export function detectCommitmentsPrompt(emails: SentEmail[], todayIso: string): string {
  const emailList = emails
    .map(
      (e) =>
        `ID: ${e.id}\nThread: ${e.threadId}\nTo: ${e.to} <${e.toEmail}>\nSubject: ${e.subject}\nBody: ${e.body.slice(0, 1000)}`
    )
    .join("\n---\n");

  return `Today is ${todayIso}. Analyze these SENT emails and find commitments — things the sender promised or agreed to do.

Look for:
- "Jag ringer dig tisdag" → commitment to call
- "Skickar offerten imorgon" → commitment to deliver something
- "Vi ses kl 14 på fredag" → meeting commitment
- "Jag återkommer" → follow-up commitment (use 3 business days as default deadline)
- "Jag kollar upp det" → follow-up commitment
- "I'll send it tomorrow" → delivery commitment
- Any promise with a time, date, or action the sender commits to

DO NOT flag:
- "Tack för info" — not a commitment
- "Låter bra" — acknowledgment
- "Hej" / "Mvh" — greetings
- Forwarded content (only analyze what the SENDER wrote, not quoted text)
- Auto-replies, out-of-office

For each commitment found, return:
- "emailId": the sent email ID
- "threadId": the thread ID
- "to_name": recipient name
- "to_email": recipient email
- "title": short action title (max 6 words, e.g. "Ring Alexander", "Skicka offert till Maria")
- "description": one sentence of context
- "type": "call" | "meeting" | "deliver" | "follow_up" | "reply"
- "due_at": ISO 8601 datetime (resolve "tomorrow", "Tuesday", "next week" relative to today). For vague promises without dates, use 3 business days from today.

Sent emails:
${emailList}

Respond ONLY with a JSON array. Return [] if no commitments found.
Example: [{"emailId": "abc", "threadId": "t1", "to_name": "Alexander", "to_email": "alex@example.com", "title": "Ring Alexander", "description": "Lovade ringa om dräneringsprojektet", "type": "call", "due_at": "2026-04-11T10:00:00"}]`;
}

export function checkResolvedPrompt(
  commitment: { title: string; description: string; to_email: string; created_at: string },
  newEmails: { from: string; to: string; subject: string; body: string }[]
): string {
  const emailList = newEmails
    .map((e) => `From: ${e.from}\nTo: ${e.to}\nSubject: ${e.subject}\nBody: ${e.body.slice(0, 500)}`)
    .join("\n---\n");

  return `A user made this commitment:
Title: ${commitment.title}
Description: ${commitment.description}
To: ${commitment.to_email}
Created: ${commitment.created_at}

Since then, these emails appeared in the same thread:
${emailList}

Has this commitment been fulfilled? Consider:
- Did the user send what they promised?
- Did the recipient acknowledge receiving it?
- Was the meeting/call completed?

Respond with ONLY a JSON object: {"resolved": true/false, "reason": "short explanation"}`;
}
