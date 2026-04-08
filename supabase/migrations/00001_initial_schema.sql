-- DigestPilot: Initial database schema
-- Run this in Supabase SQL Editor or via supabase db push

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE inbox_provider AS ENUM ('gmail', 'microsoft', 'imap');
CREATE TYPE digest_status AS ENUM ('queued', 'processing', 'completed', 'failed');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');

-- ============================================================
-- TABLES
-- ============================================================

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  timezone text NOT NULL DEFAULT 'Europe/Stockholm',
  consent_given_at timestamptz,
  consent_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Connected email accounts (billable unit)
CREATE TABLE inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider inbox_provider NOT NULL,
  email_address text NOT NULL,
  access_token text,
  refresh_token text,
  token_key_version int NOT NULL DEFAULT 1,
  token_expires_at timestamptz,
  sync_cursor text,
  sent_sync_cursor text,
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_address)
);

-- User-defined digest schedules
CREATE TABLE digest_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text,
  time time NOT NULL,
  days int[] NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Digests
CREATE TABLE digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES digest_schedules(id) ON DELETE SET NULL,
  status digest_status NOT NULL DEFAULT 'queued',
  summary_html text,
  email_count int DEFAULT 0,
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  ai_cost_cents int,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Individual email threads in a digest
CREATE TABLE digest_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id uuid NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  inbox_id uuid NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  thread_id text NOT NULL,
  from_name text,
  from_email text,
  subject text,
  body_preview text,
  token_estimate int,
  urgency urgency_level,
  category text,
  ai_summary text,
  suggested_reply text,
  user_reply text,
  reply_matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inbox_id, external_id)
);

-- Reply patterns for learning style
CREATE TABLE reply_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language text,
  email_context_summary text,
  ai_suggestion text,
  user_reply text,
  was_edited boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cron run log for monitoring
CREATE TABLE cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  users_evaluated int DEFAULT 0,
  digests_queued int DEFAULT 0,
  digests_completed int DEFAULT 0,
  digests_failed int DEFAULT 0,
  total_ai_cost_cents int DEFAULT 0,
  error_message text
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_digest_emails_thread ON digest_emails(thread_id);
CREATE INDEX idx_digest_emails_digest ON digest_emails(digest_id);
CREATE INDEX idx_digest_emails_user ON digest_emails(user_id, created_at DESC);
CREATE INDEX idx_digests_user_created ON digests(user_id, created_at DESC);
CREATE INDEX idx_digests_status ON digests(status) WHERE status IN ('queued', 'processing', 'failed');
CREATE INDEX idx_digest_schedules_active ON digest_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_reply_patterns_user_lang ON reply_patterns(user_id, language, created_at DESC);
CREATE INDEX idx_inboxes_user ON inboxes(user_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Users: read/update own row
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid());

-- Inboxes: full CRUD on own rows
CREATE POLICY "inboxes_select_own" ON inboxes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "inboxes_insert_own" ON inboxes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "inboxes_update_own" ON inboxes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "inboxes_delete_own" ON inboxes FOR DELETE USING (user_id = auth.uid());

-- Digest schedules: full CRUD on own rows
CREATE POLICY "schedules_select_own" ON digest_schedules FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "schedules_insert_own" ON digest_schedules FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "schedules_update_own" ON digest_schedules FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "schedules_delete_own" ON digest_schedules FOR DELETE USING (user_id = auth.uid());

-- Digests: read own
CREATE POLICY "digests_select_own" ON digests FOR SELECT USING (user_id = auth.uid());

-- Digest emails: read own (uses denormalized user_id)
CREATE POLICY "digest_emails_select_own" ON digest_emails FOR SELECT USING (user_id = auth.uid());

-- Reply patterns: read/write own
CREATE POLICY "patterns_select_own" ON reply_patterns FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patterns_insert_own" ON reply_patterns FOR INSERT WITH CHECK (user_id = auth.uid());

-- Cron runs: no user access (admin only via service role key)
-- No policies = no access for authenticated users

-- ============================================================
-- FUNCTION: Create user profile on auth signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger: auto-create user profile when someone signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
