-- Permanent login copy for partners an admin has approved.
-- This file does not delete partners or passwords.

create table if not exists partner_logins (
  email text primary key,
  partner_id text not null,
  name text not null,
  password_hash text not null,
  code text not null,
  approved_at timestamptz not null default now()
);
