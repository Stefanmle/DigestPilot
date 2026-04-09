interface CalendarEvent {
  title: string;
  start: string; // ISO 8601
  end?: string;  // ISO 8601, defaults to 1hr after start
  location?: string | null;
  description?: string | null;
}

/**
 * Generate a Google Calendar "Add Event" URL
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const start = formatGCalDate(event.start);
  const end = event.end ? formatGCalDate(event.end) : formatGCalDate(addHours(event.start, 1));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.location) params.set("location", event.location);
  if (event.description) params.set("details", event.description);

  // Add 15-minute reminder
  params.set("crm", "DISPLAY:15");

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate an Outlook/Office365 calendar URL
 */
export function outlookCalendarUrl(event: CalendarEvent): string {
  const startIso = new Date(event.start).toISOString();
  const endIso = event.end
    ? new Date(event.end).toISOString()
    : new Date(addHours(event.start, 1)).toISOString();

  const params = new URLSearchParams({
    rru: "addevent",
    subject: event.title,
    startdt: startIso,
    enddt: endIso,
    path: "/calendar/action/compose",
  });

  if (event.location) params.set("location", event.location);
  if (event.description) params.set("body", event.description);

  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

/**
 * Generate a .ics file content string for Apple Calendar / other clients
 */
export function generateIcsContent(event: CalendarEvent): string {
  const start = formatIcsDate(event.start);
  const end = event.end ? formatIcsDate(event.end) : formatIcsDate(addHours(event.start, 1));
  const now = formatIcsDate(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DigestPilot//EN",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DTSTAMP:${now}`,
    `UID:${crypto.randomUUID()}@digestpilot.com`,
    // 15-minute reminder
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(event.title)}`,
    "END:VALARM",
  ];

  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Format ISO date to Google Calendar format: 20260410T090000Z
 */
function formatGCalDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Format ISO date to ICS format: 20260410T090000Z
 */
function formatIcsDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Add hours to an ISO date string
 */
function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/**
 * Escape special characters for ICS format
 */
function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
