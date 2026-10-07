import type { Sql } from "./db";
import { validatePayoutRecipient, type PayoutBalance, type PayoutCurrency, type PayoutRequest, type PayoutRecipient, type PayoutStatus } from "./payout-types.ts";
import { netPartnerEarnings } from "./partner-earnings.ts";

let payoutSqlPromise: Promise<Sql> | null = null;

export function getPayoutSql(): Promise<Sql> {
  payoutSqlPromise ??= import("./db.ts").then(({ getSql }) =>
    getSql({ refreshMigrations: true }),
  ).catch((error) => {
    payoutSqlPromise = null;
    throw error;
  });
  return payoutSqlPromise;
}

type PayoutRow = {
  id: string;
  partner_name: string;
  partner_email: string;
  earning_day: string;
  currency: PayoutRequest["currency"];
  gross_amount: string | number;
  commission: number;
  amount: string | number;
  status: PayoutRequest["status"];
  created_at: Date | string;
  reviewed_at: Date | string | null;
  review_note: string;
  receiving_method: PayoutRecipient["method"] | null;
  receiving_provider: string | null;
  receiving_name: string | null;
  receiving_number: string | null;
  transfer_reference: string;
};

export type PartnerDailyEarning = {
  partnerId: string;
  currency: PayoutCurrency;
  earningDay: string;
  grossAmount: number;
  commission: number;
  payoutStatus: PayoutStatus | null;
};

type PartnerDailyEarningRow = {
  partner_id: string;
  currency: PayoutCurrency;
  earning_day: string;
  gross_amount: string | number;
  commission: string | number;
  payout_status: PayoutStatus | null;
};

const DAILY_EARNINGS_QUERY = `
  with attributed as (
    select partner.id as partner_id, p.amount,
      case when c.country = 'Nigeria'
        or (c.country is distinct from 'Ghana' and p.amount in (41986, 95968, 203932, 35000, 55000, 75000))
        then 'NGN' else 'GHS' end as currency,
      coalesce(p.confirmed_at, p.created_at) as earned_at
    from payments p
    left join referrals r on r.user_id = p.user_id
    left join player_country c on c.user_id = p.user_id
    join lateral (
      select id from partners
      where lower(code) = lower(coalesce(nullif(p.referred_by, ''), ''))
         or lower(name) = lower(coalesce(nullif(p.referred_by, ''), ''))
         or lower(code) = lower(coalesce(r.referred_by, ''))
         or lower(name) = lower(coalesce(r.referred_by, ''))
      order by case
        when lower(code) = lower(coalesce(nullif(p.referred_by, ''), '')) then 0
        when lower(name) = lower(coalesce(nullif(p.referred_by, ''), '')) then 1
        when lower(code) = lower(coalesce(r.referred_by, '')) then 2
        else 3
      end
      limit 1
    ) partner on true
    where p.status = 'confirmed' and p.counts_revenue is not false
      and ($1::text is null or partner.id = $1)
  ),
  daily as (
    select partner_id, currency,
      case currency
        when 'NGN' then (now() at time zone 'Africa/Lagos')::date - 1
        else (now() at time zone 'Africa/Accra')::date - 1
      end as earning_day,
      sum(amount)::numeric as gross_amount
    from attributed
    where (currency = 'NGN' and (earned_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date - 1)
       or (currency = 'GHS' and (earned_at at time zone 'Africa/Accra')::date = (now() at time zone 'Africa/Accra')::date - 1)
    group by partner_id, currency
  )
  select daily.partner_id, daily.currency, daily.earning_day::text as earning_day,
    daily.gross_amount, partners.commission, payout.status as payout_status
  from daily
  join partners on partners.id = daily.partner_id
  left join partner_payouts payout
    on payout.partner_id = daily.partner_id
    and payout.earning_day = daily.earning_day
    and payout.currency = daily.currency
    and payout.status in ('pending', 'paid')
  order by partners.name, daily.currency
`;

export async function readYesterdayPartnerEarnings(sql: Sql, partnerId?: string): Promise<PartnerDailyEarning[]> {
  const rows = await sql.query<PartnerDailyEarningRow>(DAILY_EARNINGS_QUERY, [partnerId ?? null]);
  return rows.map((row) => ({
    partnerId: row.partner_id,
    currency: row.currency,
    earningDay: row.earning_day,
    grossAmount: Number(row.gross_amount),
    commission: Number(row.commission),
    payoutStatus: row.payout_status,
  }));
}

export async function markPartnerYesterdayPaid(sql: Sql, partnerId: string) {
  const balances = await readYesterdayPartnerEarnings(sql, partnerId);
  if (balances.length === 0) {
    const partners = await sql<{ id: string }>`select id from partners where id = ${partnerId}`;
    if (!partners[0]) throw new Error("Partner not found.");
    throw new Error("No confirmed earnings are available from yesterday.");
  }

  const payable = balances.filter(
    (balance) => balance.payoutStatus !== "paid" && netPartnerEarnings(balance.grossAmount, balance.commission) > 0,
  );
  if (payable.length === 0) return;

  const values: unknown[] = [];
  const rows = payable.map((balance) => {
    const amount = netPartnerEarnings(balance.grossAmount, balance.commission);
    const parameters = [
      crypto.randomUUID(),
      partnerId,
      balance.earningDay,
      balance.currency,
      balance.grossAmount,
      balance.commission,
      amount,
    ];
    const placeholders = parameters.map((value) => {
      values.push(value);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")}, 'paid', now(), 'Marked paid by admin from Partners.')`;
  });

  await sql.query(
    `insert into partner_payouts
      (id, partner_id, partner_name, partner_email, earning_day, currency, gross_amount, commission, amount,
       status, reviewed_at, review_note)
     select input.id, partners.id, partners.name, partners.email, input.earning_day::date,
       input.currency, input.gross_amount::numeric, input.commission::integer, input.amount::numeric,
       input.status, input.reviewed_at, input.review_note
     from (values ${rows.join(", ")}) as input
       (id, partner_id, earning_day, currency, gross_amount, commission, amount, status, reviewed_at, review_note)
     join partners on partners.id = input.partner_id
     on conflict (partner_id, earning_day, currency) where status in ('pending', 'paid')
     do update set gross_amount = excluded.gross_amount, commission = excluded.commission,
       amount = excluded.amount, status = 'paid', reviewed_at = now(),
       review_note = excluded.review_note
     where partner_payouts.status = 'pending'`,
    values,
  );
}

function payoutFromRow(row: PayoutRow): PayoutRequest {
  return {
    id: row.id,
    partnerName: row.partner_name,
    partnerEmail: row.partner_email,
    earningDay: row.earning_day,
    currency: row.currency,
    grossAmount: Number(row.gross_amount),
    commission: Number(row.commission),
    amount: Number(row.amount),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    reviewNote: row.review_note,
    recipient: row.receiving_method && row.receiving_provider && row.receiving_name && row.receiving_number
      ? { method: row.receiving_method, provider: row.receiving_provider, accountName: row.receiving_name, accountNumber: row.receiving_number }
      : null,
    transferReference: row.transfer_reference,
  };
}

export async function readPartnerPayouts(sql: Sql, token: string) {
  const partner = await sql<{ id: string }>`select id from partners where token = ${token} and status = 'approved'`;
  if (!partner[0]) throw new Error("Sign in again.");
  const rows = await sql<PayoutRow>`
    select * from partner_payouts where partner_id = ${partner[0].id} order by created_at desc
  `;
  return rows.map(payoutFromRow);
}

export async function readAdminPayouts(sql: Sql) {
  const rows = await sql<PayoutRow>`select * from partner_payouts order by created_at desc`;
  return rows.map(payoutFromRow);
}

export async function createPayoutRequest(sql: Sql, token: string, balance: PayoutBalance, recipient: PayoutRecipient) {
  const receiving = validatePayoutRecipient(recipient);
  const amount = netPartnerEarnings(balance.grossAmount, balance.commission);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("No earnings are available for yesterday.");
  const timeZone = balance.currency === "NGN" ? "Africa/Lagos" : "Africa/Accra";
  const rows = await sql<{ id: string }>`
    insert into partner_payouts
      (id, partner_id, partner_name, partner_email, earning_day, currency, gross_amount, commission, amount,
       receiving_method, receiving_provider, receiving_name, receiving_number)
    select ${crypto.randomUUID()}, id, name, email, ${balance.earningDay}::date,
      ${balance.currency}, ${balance.grossAmount}, ${balance.commission}, ${amount},
      ${receiving.method}, ${receiving.provider}, ${receiving.accountName}, ${receiving.accountNumber}
    from partners
    where token = ${token} and status = 'approved'
      and ${balance.earningDay}::date = (now() at time zone ${timeZone})::date - 1
      and commission = ${balance.commission}
    on conflict (partner_id, earning_day, currency) where status in ('pending', 'paid') do nothing
    returning id
  `;
  if (!rows[0]) throw new Error("A payout is already pending or paid, or your earnings changed. Refresh and try again.");
}

export async function reviewPayoutRequest(
  sql: Sql,
  id: string,
  status: "paid" | "rejected",
  note: string,
  transferReference = "",
) {
  if (status === "rejected" && !note.trim()) throw new Error("Enter a reason for rejecting this payout.");
  if (status === "paid" && (!transferReference.trim() || transferReference.trim().length > 150)) throw new Error("Enter a transfer reference of up to 150 characters.");
  const rows = await sql<{ id: string }>`
    update partner_payouts set status = ${status}, review_note = ${note.trim()}, reviewed_at = now(),
      transfer_reference = ${status === "paid" ? transferReference.trim() : ""}
    where id = ${id} and status = 'pending'
      and (${status} <> 'paid' or (receiving_method is not null and receiving_provider is not null
        and receiving_name is not null and receiving_number is not null))
    returning id
  `;
  if (!rows[0]) throw new Error("This payout has already been reviewed, no longer exists, or is missing receiving details. Reject legacy requests and ask the partner to resubmit.");
}
