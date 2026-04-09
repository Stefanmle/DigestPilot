-- Sender filters: remember which senders to auto-skip or mark as spam
CREATE TABLE sender_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_address text,         -- exact email match (e.g. "news@company.com")
  email_domain text,          -- domain match (e.g. "company.com") — matches all senders from this domain
  action text NOT NULL DEFAULT 'spam', -- 'spam', 'trash', 'newsletter'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_address),
  UNIQUE (user_id, email_domain)
);

CREATE INDEX idx_sender_filters_user ON sender_filters(user_id);

ALTER TABLE sender_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filters_select_own" ON sender_filters FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "filters_insert_own" ON sender_filters FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "filters_delete_own" ON sender_filters FOR DELETE USING (user_id = auth.uid());
