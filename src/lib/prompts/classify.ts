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

  return `Classify each email with TWO properties:

1. "urgency": "high", "medium", or "low"
   - high = needs a reply today, time-sensitive, direct question/request from a real person
   - medium = should be replied to within a few days, useful information from a real person
   - low = FYI-only, no reply needed

2. "category": one of these values:
   - "personal" = from a real person, needs attention or reply
   - "work" = work-related from a colleague/client/partner
   - "newsletter" = marketing emails, newsletters, subscriptions, digests
   - "notification" = automated notifications (social media, apps, services)
   - "spam" = probable spam, unsolicited, promotional junk
   - "transactional" = receipts, confirmations, shipping updates

Emails:
${emailList}

Respond ONLY with a JSON object mapping email IDs to objects. Example:
{"msg123": {"urgency": "high", "category": "work"}, "msg456": {"urgency": "low", "category": "newsletter"}}`;
}
