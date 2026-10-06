import { createHash } from "node:crypto";
import type { Sql } from "./db";

export async function insertPaymentOnce(
  sql: Sql,
  payment: { name: string; amount: number; receipt: string; userId: string | null; referredBy: string },
) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([payment.amount, payment.receipt, payment.userId ? "" : payment.name]))
    .digest("hex");
  const rows = await sql<{ id: string; amount: number | string }>`
    insert into payments (id, payer_name, amount, status, user_id, referred_by, receipt, submission_fingerprint)
    values (${crypto.randomUUID()}, ${payment.name}, ${payment.amount}, 'pending',
      ${payment.userId}, ${payment.referredBy}, ${payment.receipt}, ${fingerprint})
    on conflict (coalesce(user_id, ''), submission_fingerprint)
      where submission_fingerprint is not null and status <> 'rejected'
    do update set submission_fingerprint = excluded.submission_fingerprint
    returning id, amount
  `;
  if (!rows[0]) throw new Error("Could not record your payment. Please try again.");
  return { ok: true, id: rows[0].id };
}
