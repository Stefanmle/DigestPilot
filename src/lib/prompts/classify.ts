interface EmailInput {
  id: string;
  from: string;
  subject: string;
  body: string;
}

export function classifyUrgencyPrompt(emails: EmailInput[]): string {
  const emailList = emails
    .map(
      (e) =>
        `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.body.slice(0, 300)}`
    )
    .join("\n---\n");

  return `Classify the urgency of each email as "high", "medium", or "low".

High = needs a reply today, time-sensitive, from an important contact, or contains a direct question/request.
Medium = should be replied to within a few days, contains useful information.
Low = newsletters, notifications, FYI-only, no reply needed.

Emails:
${emailList}

Respond ONLY with a JSON object mapping email IDs to urgency levels. Example:
{"msg123": "high", "msg456": "low"}`;
}
