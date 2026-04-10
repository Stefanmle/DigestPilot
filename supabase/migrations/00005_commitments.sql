-- Commitments: things the user promised in sent emails
CREATE TABLE commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  sent_email_external_id text, -- Gmail message ID of the sent email containing the commitment
  to_name text,
  to_email text,
  title text NOT NULL, -- Short: "Ring Alexander"
  description text, -- Full context: "Promised to call about drainage project"
  commitment_type text NOT NULL DEFAULT 'follow_up', -- call, meeting, deliver, follow_up, reply
  due_at timestamptz, -- When it should be done (null = 3-day default applied at creation)
  status text NOT NULL DEFAULT 'pending', -- pending, done, overdue, auto_resolved
  resolved_at timestamptz,
  resolved_by text, -- 'user' or 'auto'
  reminder_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),

  -- Prevent duplicate commitments in same thread
  UNIQUE (user_id, thread_id, title)
);

-- Indexes
CREATE INDEX idx_commitments_user_status ON commitments(user_id, status);
CREATE INDEX idx_commitments_user_due ON commitments(user_id, due_at);
CREATE INDEX idx_commitments_thread ON commitments(thread_id);

-- RLS
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own commitments" ON commitments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own commitments" ON commitments FOR UPDATE USING (auth.uid() = user_id);
