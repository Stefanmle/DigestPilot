-- Allowlist table for approved emails
CREATE TABLE allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Seed with initial allowed users
INSERT INTO allowlist (email) VALUES
  ('stefan.aberg84@gmail.com'),
  ('alex@lornemark.se'),
  ('lennart@lornemark.se')
ON CONFLICT (email) DO NOTHING;
