interface EmailInput {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  category?: string;
}

export function summarizePrompt(emails: EmailInput[]): string {
  // Only send personal/work emails to AI for full summarization + replies
  const needsAI = emails.filter(
    (e) => !["newsletter", "notification", "spam", "transactional"].includes(e.category ?? "")
  );

  if (needsAI.length === 0) return "";

  const emailList = needsAI
    .map(
      (e) =>
        `ID: ${e.id}\nFrom: ${e.from} <${e.fromEmail}>\nSubject: ${e.subject}\nBody:\n${e.body}`
    )
    .join("\n\n===\n\n");

  return `You are an email assistant. For each email below, provide:
1. A concise summary (2-3 sentences) that captures the key information and any action needed.
2. A suggested reply that is professional, friendly, and matches the tone of the original email.

IMPORTANT: Write ALL summaries and replies in the SAME LANGUAGE as the original email. If the email is in Swedish, respond in Swedish. If in English, respond in English.

IMPORTANT for replies: Format replies with proper paragraph breaks using \\n\\n between paragraphs. Include a greeting, body paragraph(s), and a sign-off on separate lines. Example format:
"Hej Anna,\\n\\nTack för mailet! Jag tittar på det och återkommer senast torsdag.\\n\\nMed vänliga hälsningar"

Emails:
${emailList}

Respond ONLY with a JSON array. Each item must have:
- "id" (email ID)
- "summary" (string)
- "reply" (string with \\n for line breaks)

Example:
[{"id": "msg1", "summary": "Anna asks for budget sign-off.", "reply": "Hi Anna,\\n\\nI'll review the numbers and get back to you by Thursday.\\n\\nBest regards"}]`;
}
