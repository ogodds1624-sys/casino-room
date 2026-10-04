-- Keep only accounts that finished country selection and SportyBet connection.
-- Existing rows start incomplete, then a full profile is marked isCompleted.

alter table "user" add column if not exists "isCompleted" boolean not null default false;

create table if not exists sporty_accounts (
  user_id text primary key,
  number text not null
);

alter table sporty_accounts add column if not exists linked_at timestamptz default now();

create table if not exists player_country (
  user_id text primary key,
  country text not null
);

create table if not exists referrals (
  user_id text primary key,
  referred_by text not null
);

update "user" u
set "isCompleted" = true
where exists (select 1 from sporty_accounts s where s.user_id = u.id)
  and exists (
    select 1 from player_country c
    where c.user_id = u.id and c.country in ('Ghana', 'Nigeria')
  );

delete from "session"
where "userId" in (select id from "user" where "isCompleted" = false);

delete from "account"
where "userId" in (select id from "user" where "isCompleted" = false);

delete from sporty_accounts
where user_id in (select id from "user" where "isCompleted" = false);

delete from player_country
where user_id in (select id from "user" where "isCompleted" = false);

delete from referrals
where user_id in (select id from "user" where "isCompleted" = false);

delete from "user" where "isCompleted" = false;
