create table if not exists partner_payouts (
  id text primary key,
  partner_id text not null,
  partner_name text not null,
  partner_email text not null,
  earning_day date not null,
  currency text not null check (currency in ('GHS', 'NGN')),
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  commission integer not null check (commission between 0 and 100),
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text not null default ''
);

create unique index if not exists partner_payouts_active_day
  on partner_payouts (partner_id, earning_day, currency)
  where status in ('pending', 'paid');

create index if not exists partner_payouts_history
  on partner_payouts (partner_id, created_at desc);
