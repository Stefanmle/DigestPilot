// Super admin can manage users and always has access
export const SUPER_ADMIN = "stefan.aberg84@gmail.com";

// Hardcoded fallback — used on client-side where we can't query the DB
// The real allowlist is in the Supabase 'allowlist' table, managed via /admin
const FALLBACK_ALLOWLIST = [
  "stefan.aberg84@gmail.com",
  "alex@lornemark.se",
  "lennart@lornemark.se",
];

export function isAllowedEmail(email: string): boolean {
  // Client-side check uses fallback list
  // Server-side routes should query the allowlist table directly
  return FALLBACK_ALLOWLIST.includes(email.toLowerCase());
}

export function isSuperAdmin(email: string): boolean {
  return email.toLowerCase() === SUPER_ADMIN;
}

// Server-side check against database
export async function isAllowedEmailServer(email: string, supabase: any): Promise<boolean> {
  if (email.toLowerCase() === SUPER_ADMIN) return true;

  const { data } = await supabase
    .from("allowlist")
    .select("email")
    .eq("email", email.toLowerCase())
    .single();

  return !!data;
}
