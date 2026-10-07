import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";

test("identical concurrent payment submissions and retries record exactly one payment", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(await readFile(new URL("../migrations/0002_payments.sql", import.meta.url), "utf8"));
    await pg.exec(await readFile(new URL("../migrations/0009_payment_submission_dedup.sql", import.meta.url), "utf8"));
    const { outputFiles } = await build({ entryPoints: ["src/lib/payment-submission.server.ts"], bundle: true, write: false, platform: "node", format: "cjs" });
    const require = createRequire(import.meta.url);
    const Module = require("node:module");
    const module = new Module("payment-submission-test.cjs");
    module.paths = Module._nodeModulePaths(process.cwd());
    module._compile(outputFiles[0].text, "payment-submission-test.cjs");
    const sql = async (strings, ...values) => {
      let text = strings[0];
      for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
      return (await pg.query(text, values)).rows;
    };
    const payment = { name: "", amount: 350, receipt: "data:image/png;base64,receipt-one", userId: "test-user", referredBy: "TEST" };
    const insert = module.exports.insertPaymentOnce;
    const results = await Promise.all(Array.from({ length: 10 }, () => insert(sql, payment)));
    assert.equal(new Set(results.map((row) => row.id)).size, 1);
    assert.equal((await pg.query("select count(*)::integer as total from payments")).rows[0].total, 1);
    await pg.query("update payments set status = 'confirmed'");
    assert.equal((await insert(sql, payment)).id, results[0].id);
    assert.notEqual((await insert(sql, { ...payment, userId: "another-user" })).id, results[0].id);
    assert.notEqual((await insert(sql, { ...payment, receipt: "another-receipt" })).id, results[0].id);
    await pg.query("update payments set status = 'rejected' where id = $1", [results[0].id]);
    assert.notEqual((await insert(sql, payment)).id, results[0].id);
    const ng = { ...payment, amount: 41986 };
    const nigeria = await Promise.all([insert(sql, ng), insert(sql, ng)]);
    assert.equal(nigeria[0].id, nigeria[1].id);
  } finally {
    await pg.close();
  }
});
