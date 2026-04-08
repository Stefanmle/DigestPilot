interface EmailInput {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
}

export function summarizePrompt(emails: EmailInput[]): string {
  const emailList = emails
    .map(
      (e) =>
        `ID: ${e.id}\nFrom: ${e.from} <${e.fromEmail}>\nSubject: ${e.subject}\nBody:\n${e.body}`
    )
    .join("\n\n===\n\n");

  return `You are an email assistant. For each email below, provide:
1. A concise summary (2-3 sentences) that captures the key information and any action needed.
2. A suggested reply that is professional, friendly, and matches the tone of the original email.

IMPORTANT: Write the summary and reply in the SAME LANGUAGE as the original email. If the email is in Swedish, respond in Swedish. If in English, respond in English.

Emails:
${emailList}

Respond ONLY with a JSON array. Each item must have: "id" (email ID), "summary" (string), "reply" (string).
Example:
[{"id": "msg123", "summary": "Anna asks for budget sign-off by Friday.", "reply": "Hi Anna, I'll review the numbers and get back to you by Thursday."}]`;
}
