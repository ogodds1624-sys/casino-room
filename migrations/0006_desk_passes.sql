create table if not exists desk_passes (
  token text primary key,
  user_id text not null,
  login_number text not null,
  expires_at timestamptz not null
);
