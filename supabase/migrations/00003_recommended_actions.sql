-- Add recommended action and action data to digest emails
ALTER TABLE digest_emails
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS action_data jsonb;

-- recommended_action values: 'reply', 'calendar', 'archive', 'spam', 'follow_up', 'unsubscribe'
-- action_data for calendar: { "title": "...", "start": "ISO8601", "end": "ISO8601", "location": "...", "description": "..." }
COMMENT ON COLUMN digest_emails.recommended_action IS 'AI-suggested action: reply, calendar, archive, spam, follow_up, unsubscribe';
COMMENT ON COLUMN digest_emails.action_data IS 'Structured data for the action, e.g. calendar event details';
