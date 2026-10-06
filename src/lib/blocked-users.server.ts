import { getSql, type Sql } from "@/lib/db";

export const BLOCKED_MESSAGE = "This account has been blocked. Contact support.";

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

let tablePromise: Promise<void> | null = null;

export async function ensureBlockedTable(sql: Sql) {
  tablePromise ??= (async () => {
    await sql`
      create table if not exists blocked_emails (
        email text primary key,
        created_at timestamptz not null default now()
      )
    `;
  })().catch((error) => {
    tablePromise = null;
    throw error;
  });
  return tablePromise;
}

export async function isEmailBlocked(email: string | null | undefined) {
  const value = normalizeEmail(email);
  if (!value) return false;
  try {
    const sql = await getSql();
    await ensureBlockedTable(sql);
    const rows = await sql<{ email: string }>`select email from blocked_emails where email = ${value} limit 1`;
    return rows.length > 0;
  } catch (error) {
    // A lookup failure must not lock every visitor out.
    console.error("[blocked] lookup failed", error);
    return false;
  }
}

export async function isUserIdBlocked(userId: string) {
  try {
    const sql = await getSql();
    await ensureBlockedTable(sql);
    const rows = await sql<{ email: string }>`
      select b.email from blocked_emails b
      join "user" u on lower(u.email) = b.email
      where u.id = ${userId}
      limit 1
    `;
    return rows.length > 0;
  } catch (error) {
    console.error("[blocked] lookup failed", error);
    return false;
  }
}
