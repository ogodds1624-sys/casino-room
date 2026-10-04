create table if not exists payments (
  id text primary key,
  payer_name text not null,
  amount integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
