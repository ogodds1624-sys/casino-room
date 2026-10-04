#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

// Session mode on the Supabase pooler only has a few client slots. A deploy
// that finds them full retries the same files on transaction mode (port 6543).
function transactionPoolerUrl(connectionString) {
  const at = connectionString.lastIndexOf("@");
  if (at === -1) return connectionString;
  const prefix = connectionString.slice(0, at + 1);
  const rest = connectionString.slice(at + 1);
  const slash = rest.search(/[/?]/);
  const hostport = slash === -1 ? rest : rest.slice(0, slash);
  const tail = slash === -1 ? "" : rest.slice(slash);
  if (hostport.startsWith("[")) return connectionString;
  const colon = hostport.lastIndexOf(":");
  const host = colon === -1 ? hostport : hostport.slice(0, colon);
  const port = colon === -1 ? "" : hostport.slice(colon + 1);
  if (!/pooler\.supabase\.(com|co)$/i.test(host)) return connectionString;
  if (port === "6543") return connectionString;
  if (port !== "" && port !== "5432") return connectionString;
  return `${prefix}${host}:6543${tail}`;
}

function poolIsFull(err) {
  const message = String(err?.message || err || "");
  return /EMAXCONNSESSION|max clients|too many clients|sorry, too many clients/i.test(message);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function applyMigrations(poolUrl) {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  // An app with no schema of its own must not pay for a database connection.
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({
    connectionString: poolUrl,
    max: 1,
    connectionTimeoutMillis: 8000,
    ssl: /localhost|127\.0\.0\.1/.test(poolUrl) ? undefined : { rejectUnauthorized: false },
  });
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    await pool.end();
    const fallback = transactionPoolerUrl(poolUrl);
    if (!poolIsFull(err) || fallback === poolUrl) throw err;
    console.error("[migrate] session pool is full, retrying on the transaction pooler");
    return applyMigrations(fallback);
  }
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    );

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        const fallback = transactionPoolerUrl(poolUrl);
        if (poolIsFull(err) && fallback !== poolUrl) {
          console.error("[migrate] session pool is full, retrying on the transaction pooler");
          client.release();
          client = null;
          await pool.end();
          return applyMigrations(fallback);
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    if (client) client.release();
    await pool.end().catch(() => undefined);
  }
}

applyMigrations(databaseUrl).catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
