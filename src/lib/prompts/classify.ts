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

  return `Classify each email. Return a JSON object mapping each email ID to an object with these fields:

"urgency": "high" | "medium" | "low"
  - high = needs reply today, time-sensitive, direct question from real person
  - medium = reply within days, useful info from real person
  - low = FYI-only, no reply needed

"category": "personal" | "work" | "newsletter" | "notification" | "spam" | "transactional"

"action": the single best next step for the user:
  - "reply" = needs a response to a real person
  - "calendar" = contains a date/event/deadline/meeting to track. MUST include "event" object
  - "follow_up" = check back later (e.g. awaiting someone else's response, pending process)
  - "archive" = no action needed (receipts, confirmations, pure FYI)
  - "spam" = junk to block
  - "unsubscribe" = newsletter/marketing user likely doesn't want

"action_reason": SHORT explanation (max 10 words) of WHY this action. Examples:
  - "Meeting invite for Thursday 10am"
  - "Client asked about pricing"
  - "Awaiting shipping delivery Friday"
  - "Weekly promo — not opened recently"
  - "Receipt for App Store purchase"
  This helps the user understand the action at a glance.

"event" (ONLY when action is "calendar"):
  - "title": short event title
  - "start": ISO 8601 datetime (best guess, use today's date if only time mentioned)
  - "end": ISO 8601 datetime (default: 1 hour after start)
  - "location": string or null
  - "description": one-line context

Emails:
${emailList}

Respond ONLY with JSON. Example:
{"id1": {"urgency": "high", "category": "work", "action": "reply", "action_reason": "Client asked about project timeline"}, "id2": {"urgency": "low", "category": "newsletter", "action": "unsubscribe", "action_reason": "Marketing promo — likely unwanted"}, "id3": {"urgency": "medium", "category": "work", "action": "calendar", "action_reason": "Team meeting Thursday 2pm", "event": {"title": "Team sync", "start": "2026-04-10T14:00:00", "end": "2026-04-10T15:00:00", "location": "Google Meet", "description": "Weekly team sync"}}, "id4": {"urgency": "low", "category": "notification", "action": "follow_up", "action_reason": "Package arriving Friday"}}`;
}
