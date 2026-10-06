alter table partner_payouts add column if not exists receiving_method text
  check (receiving_method in ('mobile_money', 'bank'));
alter table partner_payouts add column if not exists receiving_provider text;
alter table partner_payouts add column if not exists receiving_name text;
alter table partner_payouts add column if not exists receiving_number text;
alter table partner_payouts add column if not exists transfer_reference text not null default '';
