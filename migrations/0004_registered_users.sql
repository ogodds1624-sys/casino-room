-- Keep a permanent copy of every account that reached the package page.
-- Inserts are one-time. This file does not delete users or credentials.

create table if not exists registered_users (
  user_id text primary key,
  name text not null,
  email text not null,
  country text not null,
  sporty_number text not null,
  password_hash text,
  registered_at timestamptz not null default now()
);

insert into registered_users (user_id, name, email, country, sporty_number, password_hash, registered_at)
select u.id,
  u.name,
  u.email,
  c.country,
  s.number,
  (
    select a.password
    from "account" a
    where a."userId" = u.id and a.password is not null
    order by case when a."providerId" = 'credential' then 0 else 1 end
    limit 1
  ),
  coalesce(s.linked_at, u."createdAt", now())
from "user" u
join player_country c on c.user_id = u.id
join sporty_accounts s on s.user_id = u.id
where c.country in ('Ghana', 'Nigeria')
on conflict (user_id) do update
set password_hash = coalesce(registered_users.password_hash, excluded.password_hash);

update "user" u
set "isCompleted" = true
where exists (select 1 from registered_users r where r.user_id = u.id)
  and u."isCompleted" is not true;
