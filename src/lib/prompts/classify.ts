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
        `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.body.slice(0, 500)}`
    )
    .join("\n---\n");

  return `Classify each email with THREE properties:

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

3. "action": the single best action for the user. One of:
   - "reply" = email needs a reply (from a real person asking something)
   - "calendar" = contains an event, meeting, deadline, appointment, or date to remember. MUST also include "event" object
   - "follow_up" = no immediate reply needed, but should check back later
   - "archive" = informational only, no action needed (receipts, confirmations, FYI)
   - "spam" = junk, should be blocked
   - "unsubscribe" = newsletter/marketing the user probably doesn't want

4. "event" (ONLY when action is "calendar"): extract event details
   - "title": short event title
   - "start": ISO 8601 datetime (best guess from email content, use today's date if only time given)
   - "end": ISO 8601 datetime (if not specified, assume 1 hour after start)
   - "location": location if mentioned, or null
   - "description": one-line description

Emails:
${emailList}

Respond ONLY with a JSON object mapping email IDs to objects. Examples:
{"msg123": {"urgency": "high", "category": "work", "action": "reply"}, "msg456": {"urgency": "low", "category": "newsletter", "action": "unsubscribe"}, "msg789": {"urgency": "high", "category": "work", "action": "calendar", "event": {"title": "Team standup", "start": "2026-04-10T09:00:00", "end": "2026-04-10T09:30:00", "location": "Zoom", "description": "Weekly team standup meeting"}}}`;
}
