import type { OnboardingAcceptance } from "@/lib/onboarding-gate";
import { sportyNumberMatches } from "@/lib/onboarding-gate";

async function sqlClient() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function ensureProfileTables(sql: Awaited<ReturnType<typeof sqlClient>>) {
  await sql`
    create table if not exists sporty_accounts (
      user_id text primary key,
      number text not null
    )
  `;
  await sql`alter table sporty_accounts add column if not exists linked_at timestamptz default now()`;
  await sql`
    create table if not exists player_country (
      user_id text primary key,
      country text not null
    )
  `;
}

export async function persistOnboarding(gate: OnboardingAcceptance) {
  if (gate.completionStatus !== true) {
    throw new Error("ONBOARDING_INCOMPLETE");
  }
  if (!sportyNumberMatches(gate.country, gate.sportyNumber)) {
    throw new Error("ONBOARDING_INCOMPLETE");
  }
  const sql = await sqlClient();
  await ensureProfileTables(sql);
  const rows = await sql<{ id: string }>`select id from "user" where lower(email) = ${gate.email} limit 1`;
  const id = rows[0]?.id;
  if (!id) throw new Error("ONBOARDING_INCOMPLETE");
  await sql`
    insert into player_country (user_id, country)
    values (${id}, ${gate.country})
    on conflict (user_id) do update set country = excluded.country
  `;
  await sql`
    insert into sporty_accounts (user_id, number, linked_at)
    values (${id}, ${gate.sportyNumber}, now())
    on conflict (user_id) do nothing
  `;
  const marked = await sql<{ id: string }>`
    update "user" u
    set "isCompleted" = true
    where u.id = ${id}
      and exists (select 1 from sporty_accounts s where s.user_id = u.id)
      and exists (
        select 1 from player_country c
        where c.user_id = u.id and c.country in ('Ghana', 'Nigeria')
      )
    returning u.id
  `;
  if (!marked[0]?.id) throw new Error("ONBOARDING_INCOMPLETE");
  const { retainRegisteredProfile } = await import("@/lib/admin-snapshot");
  const retained = await retainRegisteredProfile(sql, id);
  if (!retained) throw new Error("ONBOARDING_INCOMPLETE");
}

export async function rollbackOnboarding(email: string) {
  const sql = await sqlClient();
  await ensureProfileTables(sql);
  const rows = await sql<{ id: string; completed: boolean }>`
    select id, "isCompleted" as completed from "user" where lower(email) = ${email.toLowerCase()} limit 1
  `;
  const id = rows[0]?.id;
  if (!id) return;
  const flag = rows[0]?.completed as unknown;
  if (flag === true || flag === "t" || flag === "true" || flag === 1) return;
  try {
    const kept = await sql<{ user_id: string }>`select user_id from registered_users where user_id = ${id} limit 1`;
    if (kept.length > 0) return;
  } catch {
    // The permanent table is created with the package profile. A missing table means this account was never registered.
  }
  await sql`delete from sporty_accounts where user_id = ${id}`;
  await sql`delete from player_country where user_id = ${id}`;
  await sql`
    create table if not exists referrals (
      user_id text primary key,
      referred_by text not null
    )
  `;
  await sql`delete from referrals where user_id = ${id}`;
  await sql`delete from "user" where id = ${id}`;
}
