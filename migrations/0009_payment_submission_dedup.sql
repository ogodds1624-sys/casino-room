alter table payments add column if not exists submission_fingerprint text;
create unique index if not exists payments_submission_once
  on payments (coalesce(user_id, ''), submission_fingerprint)
  where submission_fingerprint is not null and status <> 'rejected';
