-- Add action_reason column for human-readable action explanation
ALTER TABLE digest_emails ADD COLUMN IF NOT EXISTS action_reason text;
