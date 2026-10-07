alter table payments add column if not exists counts_revenue boolean not null default true;
alter table payments add column if not exists confirmed_at timestamptz;

create table if not exists tester_accounts (
  email text primary key
);

insert into tester_accounts (email)
values ('cooljswanzy@gmail.com')
on conflict (email) do nothing;

update payments p
set counts_revenue = false
where exists (
  select 1 from "user" u
  where u.id = p.user_id and lower(u.email) in (select email from tester_accounts)
)
or exists (
  select 1 from registered_users r
  where r.user_id = p.user_id and lower(r.email) in (select email from tester_accounts)
);
