import type { Sql } from "./db";
import type { PayoutBalance, PayoutRequest } from "./payout-types";
import { netPartnerEarnings } from "./partner-earnings.ts";

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
};

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

export async function createPayoutRequest(sql: Sql, token: string, balance: PayoutBalance) {
  const amount = netPartnerEarnings(balance.grossAmount, balance.commission);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("No earnings are available for yesterday.");
  const timeZone = balance.currency === "NGN" ? "Africa/Lagos" : "Africa/Accra";
  const rows = await sql<{ id: string }>`
    insert into partner_payouts
      (id, partner_id, partner_name, partner_email, earning_day, currency, gross_amount, commission, amount)
    select ${crypto.randomUUID()}, id, name, email, ${balance.earningDay}::date,
      ${balance.currency}, ${balance.grossAmount}, ${balance.commission}, ${amount}
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
) {
  if (status === "rejected" && !note.trim()) throw new Error("Enter a reason for rejecting this payout.");
  const rows = await sql<{ id: string }>`
    update partner_payouts set status = ${status}, review_note = ${note.trim()}, reviewed_at = now()
    where id = ${id} and status = 'pending'
    returning id
  `;
  if (!rows[0]) throw new Error("This payout has already been reviewed or no longer exists.");
}
