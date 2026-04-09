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
        `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nBody: ${e.body.slice(0, 1000)}`
    )
    .join("\n---\n");

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const isoDate = today.toISOString().slice(0, 10);

  return `Today is ${dateStr} (${isoDate}). Use this to resolve relative dates like "tomorrow", "next week", "Friday", etc.

Classify each email. Return a JSON object mapping each email ID to an object with these fields:

"urgency": "high" | "medium" | "low"
  - high = needs reply today, time-sensitive, direct question from real person
  - medium = reply within days, useful info from real person
  - low = FYI-only, no reply needed

"category": one of:
  - "personal" = from a real person you know, direct conversation (NOT mass emails)
  - "work" = work-related from colleague/client/partner/supplier — direct business communication
  - "newsletter" = mass emails, marketing, promotions, offers, digests, subscriptions — even if relevant to work. Key sign: sent to many people, not specifically to you
  - "notification" = automated alerts from apps/services (social media, monitoring, etc.)
  - "spam" = unsolicited junk
  - "transactional" = receipts, confirmations, shipping, invoices
  IMPORTANT: If an email has an "unsubscribe" link, promotional language, discount offers, or is clearly sent to a mailing list — it is "newsletter", NOT "personal" or "work"

"action": the single best next step for the user:
  - "reply" = needs a response to a real person
  - "calendar" = ONLY use when the email is purely an event/meeting invite with no reply needed
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

"event" (include whenever ANY date, time, meeting, deadline, or appointment is mentioned — even if action is "reply" or "follow_up"):
  - "title": short, clear title describing the PRIMARY thing happening (e.g. "Meeting at Alexander's", "Call with client")
  - "start": ISO 8601 datetime for the PRIMARY event (read carefully — "come at 11:00" means 11:00, not 9:00)
  - "end": ISO 8601 datetime (default: 1 hour after start)
  - "location": physical address, phone number, Zoom/Meet link — whatever is most relevant for the PRIMARY event
  - "description": include ALL key details: phone numbers, addresses, backup plans, conditions
  IMPORTANT: Read the email carefully to understand what the PRIMARY event is. Example:
  - "Come to Storgatan 5 at 11:00. If you can't, call me at 073-1234567 before 8:00" → the event is the VISIT at 11:00, location is the ADDRESS, and the phone number goes in description as backup.
  - "Call me at 0704405600 tomorrow at 9am" → the event is the CALL at 9:00, location is "tel:0704405600".

Emails:
${emailList}

Respond ONLY with JSON. Example:
{"id1": {"urgency": "high", "category": "work", "action": "reply", "action_reason": "Wants a call tomorrow 9am", "event": {"title": "Call Alexander", "start": "2026-04-10T09:00:00", "end": "2026-04-10T09:30:00", "location": "tel:0704405600", "description": "Call Alexander at 0704405600 — needs help urgently"}}, "id2": {"urgency": "low", "category": "newsletter", "action": "unsubscribe", "action_reason": "Marketing promo — likely unwanted"}, "id3": {"urgency": "medium", "category": "work", "action": "calendar", "action_reason": "Team meeting Thursday 2pm", "event": {"title": "Team sync", "start": "2026-04-10T14:00:00", "end": "2026-04-10T15:00:00", "location": "Google Meet", "description": "Weekly team sync"}}, "id4": {"urgency": "low", "category": "notification", "action": "follow_up", "action_reason": "Package arriving Friday"}}`;
}
