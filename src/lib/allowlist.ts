// Super admin can manage users and always has access
export const SUPER_ADMIN = "stefan.aberg84@gmail.com";

// Allowed emails — managed by super admin via Supabase users table (is_approved field)
// For now, these emails bypass the approval check
const HARDCODED_ALLOWLIST = [
  "stefan.aberg84@gmail.com",
  "alex@lornemark.se",
  "lennart@lornemark.se",
];

export function isAllowedEmail(email: string): boolean {
  return HARDCODED_ALLOWLIST.includes(email.toLowerCase());
}

export function isSuperAdmin(email: string): boolean {
  return email.toLowerCase() === SUPER_ADMIN;
}
