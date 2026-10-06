import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db";
import { validatePayoutRecipient, type PayoutBalance, type PayoutRecipient } from "./payout-types.ts";
import { createPayoutRequest as insertPayoutRequest, readAdminPayouts, readPartnerPayouts, reviewPayoutRequest } from "./partner-payouts.server.ts";
import { randomBytes } from "node:crypto";
import { requireAdminSession, signInAdmin } from "./admin-access.server.ts";

const receiving: PayoutRecipient = { method: "bank", provider: "Test Bank", accountName: "Partner A", accountNumber: "0012345678" };
function createPayoutRequest(sql: Sql, token: string, balance: PayoutBalance) {
  return insertPayoutRequest(sql, token, balance, receiving);
}

test("receiving details validate country-specific methods, numbers and required fields", () => {
  assert.deepEqual(validatePayoutRecipient(receiving, "NGN"), receiving);
  const momo: PayoutRecipient = { method: "mobile_money", provider: "MTN Mobile Money", accountName: "Test Partner", accountNumber: "0241234567" };
  assert.deepEqual(validatePayoutRecipient(momo, "GHS"), momo);
  assert.throws(() => validatePayoutRecipient(momo, "NGN"), /require a bank/);
  assert.throws(() => validatePayoutRecipient(undefined, "GHS"), /receiving details/);
  assert.throws(() => validatePayoutRecipient({ ...receiving, accountName: "" }, "GHS"), /holder/);
  assert.throws(() => validatePayoutRecipient({ ...receiving, provider: "" }, "GHS"), /provider/);
  assert.throws(() => validatePayoutRecipient({ ...receiving, accountNumber: "12345" }, "NGN"), /10-digit/);
  assert.throws(() => validatePayoutRecipient({ ...receiving, accountNumber: "123x567890" }, "GHS"), /digits/);
  assert.throws(() => validatePayoutRecipient({ ...momo, provider: "Unknown" }, "GHS"), /provider/);
  assert.throws(() => validatePayoutRecipient({ ...momo, accountNumber: "241234567" }, "GHS"), /starting with 0/);
});

test("admin sessions require configuration, correct credentials and an unexpired signature", () => {
  const original = process.env.ADMIN_PASSCODE;
  try {
    delete process.env.ADMIN_PASSCODE;
    assert.throws(() => signInAdmin("test"), /not configured/);
    process.env.ADMIN_PASSCODE = randomBytes(24).toString("hex");
    assert.throws(() => signInAdmin("wrong"), /Wrong passcode/);
    const now = Date.now();
    const token = signInAdmin(process.env.ADMIN_PASSCODE, now);
    assert.doesNotThrow(() => requireAdminSession(token, now));
    assert.throws(() => requireAdminSession("", now), /expired/);
    assert.throws(() => requireAdminSession(token + ".extra", now), /expired/);
    const [expiry, nonce, signature] = token.split(".");
    assert.throws(() => requireAdminSession(`${Number(expiry) + 1000}.${nonce}.${signature}`, now), /expired/);
    assert.throws(() => requireAdminSession(token, now + 8 * 60 * 60 * 1000), /expired/);
    process.env.ADMIN_PASSCODE = randomBytes(24).toString("hex");
    assert.throws(() => requireAdminSession(token, now), /expired/);
  } finally {
    if (original === undefined) delete process.env.ADMIN_PASSCODE;
    else process.env.ADMIN_PASSCODE = original;
  }
});

test("payout database workflow preserves snapshots and prevents duplicate payments", async (t) => {
  const pg = new PGlite({
    parsers: { 1082: (value: string) => value },
  });
  try {
    await pg.exec(await readFile(new URL("../../migrations/0007_partner_payouts.sql", import.meta.url), "utf8"));
    await pg.exec(await readFile(new URL("../../migrations/0008_payout_receiving_details.sql", import.meta.url), "utf8"));
    await pg.exec(`
      create table partners (id text primary key, name text, email text, token text, status text, commission integer);
      insert into partners values
        ('a', 'Partner A', 'a@example.test', 'token-a', 'approved', 20),
        ('b', 'Partner B', 'b@example.test', 'token-b', 'approved', 20),
        ('c', 'Partner C', 'c@example.test', 'token-c', 'locked', 20);
    `);
    const run = async <T>(text: string, values: unknown[] = []) => (await pg.query<T>(text, values)).rows;
    const sql: Sql = Object.assign(
      async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
        let text = strings[0];
        for (let index = 0; index < values.length; index++) text += `$${index + 1}${strings[index + 1]}`;
        return run<T>(text, values);
      },
      { query: run },
    );
    const dates = await sql<{ gh: string; ng: string }>`
      select ((now() at time zone 'Africa/Accra')::date - 1) as gh,
        ((now() at time zone 'Africa/Lagos')::date - 1) as ng
    `;
    const gh: PayoutBalance = { earningDay: dates[0].gh, currency: "GHS", grossAmount: 1000, commission: 20, amount: 999999 };
    const ng: PayoutBalance = { ...gh, earningDay: dates[0].ng, currency: "NGN", grossAmount: 100000 };

    await t.test("server recalculates net amount and rejects simultaneous duplicate requests", async () => {
      const results = await Promise.allSettled([
        createPayoutRequest(sql, "token-a", gh),
        createPayoutRequest(sql, "token-a", gh),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const requests = await readPartnerPayouts(sql, "token-a");
      assert.equal(requests.length, 1);
      assert.equal(requests[0].amount, 800);
      assert.equal(requests[0].grossAmount, 1000);
      assert.equal(requests[0].commission, 20);
      assert.deepEqual(requests[0].recipient, receiving);
      assert.equal(requests[0].recipient?.accountNumber, "0012345678");
    });

    await t.test("currencies and partners remain separate and unauthorized reads fail", async () => {
      await createPayoutRequest(sql, "token-a", ng);
      await createPayoutRequest(sql, "token-b", gh);
      assert.equal((await readPartnerPayouts(sql, "token-a")).length, 2);
      assert.equal((await readPartnerPayouts(sql, "token-b")).length, 1);
      assert.equal((await readAdminPayouts(sql)).length, 3);
      await assert.rejects(readPartnerPayouts(sql, "missing"), /Sign in/);
      await assert.rejects(readPartnerPayouts(sql, "token-c"), /Sign in/);
      await assert.rejects(createPayoutRequest(sql, "token-c", gh), /already pending or paid/);
    });

    await t.test("only yesterday's positive net earnings at the current rate are eligible", async () => {
      await assert.rejects(createPayoutRequest(sql, "token-b", { ...ng, earningDay: "2000-01-01" }), /Refresh/);
      await assert.rejects(createPayoutRequest(sql, "token-b", { ...ng, grossAmount: 0 }), /No earnings/);
      await assert.rejects(createPayoutRequest(sql, "token-b", { ...ng, commission: 100 }), /No earnings/);
      await assert.rejects(createPayoutRequest(sql, "token-b", { ...ng, commission: 30 }), /Refresh/);
    });

    await t.test("rejected requests require a reason and may be resubmitted without losing history", async () => {
      const request = (await readPartnerPayouts(sql, "token-a")).find((row) => row.currency === "GHS")!;
      await assert.rejects(reviewPayoutRequest(sql, request.id, "rejected", ""), /reason/);
      await reviewPayoutRequest(sql, request.id, "rejected", "Please contact support.");
      await createPayoutRequest(sql, "token-a", gh);
      const rows = await readPartnerPayouts(sql, "token-a");
      assert.equal(rows.filter((row) => row.currency === "GHS").length, 2);
      assert.equal(rows.find((row) => row.id === request.id)?.reviewNote, "Please contact support.");
      await assert.rejects(reviewPayoutRequest(sql, request.id, "paid", "", "TEST-REF"), /already been reviewed/);
    });

    await t.test("paid requests block repeat claims and retain the submitted commission snapshot", async () => {
      const request = (await readPartnerPayouts(sql, "token-a")).find((row) => row.currency === "GHS" && row.status === "pending")!;
      await assert.rejects(reviewPayoutRequest(sql, request.id, "paid", ""), /transfer reference/);
      await reviewPayoutRequest(sql, request.id, "paid", "Payment sent", "TEST-01");
      await sql`update partners set commission = 35 where id = 'a'`;
      await assert.rejects(createPayoutRequest(sql, "token-a", { ...gh, commission: 35 }), /already pending or paid/);
      const saved = (await readPartnerPayouts(sql, "token-a")).find((row) => row.id === request.id)!;
      assert.equal(saved.status, "paid");
      assert.equal(saved.amount, 800);
      assert.equal(saved.commission, 20);
      assert.ok(saved.reviewedAt);
      assert.equal(saved.transferReference, "TEST-01");
      assert.deepEqual(saved.recipient, receiving);
      await assert.rejects(reviewPayoutRequest(sql, request.id, "rejected", "Too late"), /already been reviewed/);
    });
    await t.test("resubmissions save new receiving details without changing rejected history", async () => {
      const request = (await readPartnerPayouts(sql, "token-b"))[0];
      await reviewPayoutRequest(sql, request.id, "rejected", "Update your bank details.");
      const changed = { ...receiving, provider: "New Bank", accountNumber: "0098765432" };
      await insertPayoutRequest(sql, "token-b", gh, changed);
      const history = await readPartnerPayouts(sql, "token-b");
      assert.deepEqual(history.find((row) => row.id === request.id)?.recipient, receiving);
      assert.deepEqual(history.find((row) => row.status === "pending")?.recipient, changed);
    });
    await t.test("legacy requests remain readable but cannot be marked paid without receiving details", async () => {
      await sql`insert into partner_payouts (id, partner_id, partner_name, partner_email, earning_day, currency, gross_amount, commission, amount)
        values ('legacy', 'legacy-partner', 'Legacy', 'legacy@example.test', ${dates[0].gh}::date, 'GHS', 1000, 20, 800)`;
      const legacy = (await readAdminPayouts(sql)).find((row) => row.id === "legacy");
      assert.equal(legacy?.recipient, null);
      await assert.rejects(reviewPayoutRequest(sql, "legacy", "paid", "", "REF"), /missing receiving details/);
      await reviewPayoutRequest(sql, "legacy", "rejected", "Resubmit with receiving details.");
    });
  } finally {
    await pg.close();
  }
});
