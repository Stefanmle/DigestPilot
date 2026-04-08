interface EmailInput {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  category?: string;
}

export function summarizePrompt(emails: EmailInput[]): string {
  // Only summarize + suggest replies for emails that need it
  const needsReply = emails.filter(
    (e) => !["newsletter", "notification", "spam", "transactional"].includes(e.category ?? "")
  );
  const noReply = emails.filter((e) =>
    ["newsletter", "notification", "spam", "transactional"].includes(e.category ?? "")
  );

  const replyEmailList = needsReply
    .map(
      (e) =>
        `ID: ${e.id}\nFrom: ${e.from} <${e.fromEmail}>\nSubject: ${e.subject}\nBody:\n${e.body}`
    )
    .join("\n\n===\n\n");

  const noReplyEmailList = noReply
    .map(
      (e) =>
        `ID: ${e.id}\nFrom: ${e.from} <${e.fromEmail}>\nSubject: ${e.subject}\nCategory: ${e.category}\nBody:\n${e.body.slice(0, 500)}`
    )
    .join("\n\n===\n\n");

  let prompt = `You are an email assistant. Process the following emails.

IMPORTANT: Write ALL summaries and replies in the SAME LANGUAGE as the original email. If the email is in Swedish, respond in Swedish. If in English, respond in English.`;

  if (needsReply.length > 0) {
    prompt += `

## Emails that need a reply
For each, provide a concise summary (2-3 sentences) AND a suggested reply that is professional, friendly, and matches the tone.

${replyEmailList}`;
  }

  if (noReply.length > 0) {
    prompt += `

## Newsletters, notifications, and automated emails
For each, provide ONLY a brief 1-sentence summary. Do NOT generate a reply.

${noReplyEmailList}`;
  }

  prompt += `

Respond ONLY with a JSON array. Each item must have:
- "id" (email ID)
- "summary" (string)
- "reply" (string or null — null for newsletters/notifications/spam/transactional)

Example:
[{"id": "msg1", "summary": "Anna asks for budget sign-off.", "reply": "Hi Anna, I'll review and get back to you."}, {"id": "msg2", "summary": "Weekly newsletter from TechCrunch.", "reply": null}]`;

  return prompt;
}
