import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";

test("payout server functions derive yesterday's earnings and enforce partner/admin access", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const pg = new PGlite({ parsers: { 1082: (value) => value } });
  const originalPasscode = process.env.ADMIN_PASSCODE;
  const originalSql = globalThis.__payoutTestSql;
  const originalRefreshes = globalThis.__payoutTestRefreshes;
  globalThis.__payoutTestRefreshes = 0;
  try {
    for (const name of (await readdir(join(root, "migrations"))).filter((name) => name.endsWith(".sql")).sort()) {
      await pg.exec(await readFile(join(root, "migrations", name), "utf8"));
    }
    const run = async (text, params = []) => (await pg.query(text, params)).rows;
    globalThis.__payoutTestSql = Object.assign(async (strings, ...values) => {
      let text = strings[0];
      for (let index = 0; index < values.length; index++) text += `$${index + 1}${strings[index + 1]}`;
      return run(text, values);
    }, { query: run });

    const bundled = await build({
      stdin: {
        contents: 'export * from "./src/lib/partner-payouts"; export { getPartnerPortal } from "./src/lib/admin-snapshot";',
        resolveDir: root,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      packages: "external",
      logLevel: "error",
      plugins: [{
        name: "test-server-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /^@tanstack\/react-start$/ }, () => ({ path: "serverfn", namespace: "test" }));
          builder.onResolve({ filter: /^(?:@\/lib\/db|\.\/db(?:\.ts)?)$/ }, () => ({ path: "db", namespace: "test" }));
          builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({
            contents: path === "db"
              ? "export async function getSql(options = {}) { if (options.refreshMigrations) globalThis.__payoutTestRefreshes++; return globalThis.__payoutTestSql; }"
              : "export function createServerFn() { let validate = (data) => data; return { inputValidator(fn) { validate = fn; return this; }, handler(fn) { return async (opts = {}) => fn({ data: validate(opts.data) }); } }; }",
            loader: "js",
          }));
        },
      }],
    });
    const require = createRequire(import.meta.url);
    const Module = require("node:module");
    const module = new Module(join(root, "payout-test.cjs"));
    module.filename = join(root, "payout-test.cjs");
    module.paths = Module._nodeModulePaths(root);
    module._compile(bundled.outputFiles[0].text, module.filename);
    const api = module.exports;

    await assert.rejects(api.getPartnerPortal({ data: { token: "missing" } }), /Sign in again/);
    await pg.exec(`
      insert into partners (id, name, email, password_hash, code, status, token, commission)
      values ('payout-fixture', 'Payout Fixture', 'fixture@example.test', 'test-only', 'FIXTURE', 'approved', 'fixture-token', 20);
      insert into payments (id, payer_name, amount, status, referred_by, user_id, counts_revenue, confirmed_at)
      values
        ('gh-yesterday', 'Ghana', 1000, 'confirmed', 'FIXTURE', 'gh-fixture', true, date_trunc('day', now() at time zone 'Africa/Accra') at time zone 'Africa/Accra' - interval '12 hours'),
        ('ng-yesterday', 'Nigeria', 100000, 'confirmed', 'FIXTURE', 'ng-fixture', true, date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos' - interval '12 hours'),
        ('gh-today', 'Ghana', 500, 'confirmed', 'FIXTURE', 'gh-fixture', true, now()),
        ('gh-pending', 'Ghana', 700, 'pending', 'FIXTURE', 'gh-fixture', true, now() - interval '1 day'),
        ('gh-reversed', 'Ghana', 900, 'confirmed', 'FIXTURE', 'gh-fixture', false, now() - interval '1 day');
      insert into player_country (user_id, country) values ('gh-fixture', 'Ghana'), ('ng-fixture', 'Nigeria');
    `);
    const recipient = { method: "bank", provider: "Test Bank", accountName: "Payout Fixture", accountNumber: "0012345678" };
    const partnerData = { token: "fixture-token", recipient };
    const portal = await api.getPartnerPortal({ data: partnerData });
    const payouts = await api.getPartnerPayouts({ data: partnerData });
    const gh = payouts.balances.find((row) => row.currency === "GHS");
    const ng = payouts.balances.find((row) => row.currency === "NGN");
    assert.equal(gh.grossAmount, 1000);
    assert.equal(gh.amount, 800);
    assert.equal(ng.amount, 80000);
    assert.equal(portal.earnings, 1200);
    assert.equal(portal.todayCut, 400);
    assert.equal(portal.days.at(-2).cut, 800);

    await assert.rejects(api.requestPartnerPayout({ data: { ...partnerData, currency: "GHS", earningDay: "2000-01-01" } }), /only request yesterday/);
    await assert.rejects(api.requestPartnerPayout({ data: { ...partnerData, currency: "USD", earningDay: gh.earningDay } }), /Choose Ghana/);
    const requested = await api.requestPartnerPayout({ data: { ...partnerData, currency: "GHS", earningDay: gh.earningDay, amount: 999999, commission: 0 } });
    assert.equal(requested.requests[0].amount, 800);
    assert.deepEqual(requested.requests[0].recipient, recipient);
    await assert.rejects(api.requestPartnerPayout({ data: { token: partnerData.token, currency: "NGN", earningDay: ng.earningDay } }), /receiving details/);
    await assert.rejects(api.requestPartnerPayout({ data: { ...partnerData, currency: "NGN", earningDay: ng.earningDay, recipient: { ...recipient, method: "mobile_money" } } }), /require a bank/);
    await assert.rejects(api.requestPartnerPayout({ data: { ...partnerData, currency: "GHS", earningDay: gh.earningDay } }), /already pending or paid/);

    process.env.ADMIN_PASSCODE = randomBytes(24).toString("hex");
    await assert.rejects(api.getAdminPayouts({ data: { adminToken: "forged" } }), /expired/);
    await assert.rejects(api.reviewPartnerPayout({ data: { adminToken: "forged", id: requested.requests[0].id, status: "paid", note: "", transferReference: "TEST" } }), /expired/);
    const { token: adminToken } = await api.adminSignIn({ data: { passcode: process.env.ADMIN_PASSCODE } });
    assert.equal((await api.getAdminPayouts({ data: { adminToken } })).length, 1);
    await assert.rejects(api.reviewPartnerPayout({ data: { adminToken, id: requested.requests[0].id, status: "paid", note: "" } }), /transfer reference/);
    await api.reviewPartnerPayout({ data: { adminToken, id: requested.requests[0].id, status: "paid", note: "Transfer completed", transferReference: "TEST-REFERENCE" } });
    const transfer = (await api.getPartnerPayouts({ data: partnerData })).requests[0];
    assert.equal(transfer.status, "paid");
    assert.equal(transfer.transferReference, "TEST-REFERENCE");
    assert.deepEqual(transfer.recipient, recipient);

    await pg.exec("update partners set commission = 35 where id = 'payout-fixture'");
    const updated = await api.getPartnerPayouts({ data: partnerData });
    assert.equal(updated.balances.find((row) => row.currency === "GHS").amount, 650);
    assert.equal(updated.requests[0].amount, 800);
    await pg.exec("update partners set status = 'locked' where id = 'payout-fixture'");
    await assert.rejects(api.getPartnerPayouts({ data: partnerData }), /Sign in again/);
    await assert.rejects(api.requestPartnerPayout({ data: { ...partnerData, currency: "NGN", earningDay: ng.earningDay } }), /Sign in again/);
    assert.equal(globalThis.__payoutTestRefreshes, 1, "payout initialization refreshes migrations once, not on every poll");
  } finally {
    if (originalPasscode === undefined) delete process.env.ADMIN_PASSCODE;
    else process.env.ADMIN_PASSCODE = originalPasscode;
    if (originalSql === undefined) delete globalThis.__payoutTestSql;
    else globalThis.__payoutTestSql = originalSql;
    if (originalRefreshes === undefined) delete globalThis.__payoutTestRefreshes;
    else globalThis.__payoutTestRefreshes = originalRefreshes;
    await pg.close();
  }
});
