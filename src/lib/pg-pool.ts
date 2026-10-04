import { Pool, types } from "pg";

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;

const globalPool = globalThis as typeof globalThis & {
  __aviatorPgPool__?: Pool;
  __aviatorPgParsers__?: boolean;
};

/**
 * Supabase session pooler (port 5432 on `*.pooler.supabase.com`) gives each
 * client its own server connection and caps that at pool_size (15 on small
 * projects). The driver reports:
 * (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
 *
 * Port 6543 is the same pooler in transaction mode. A client only borrows a
 * server connection for the duration of a transaction, so warm serverless
 * instances can keep a socket open without filling those 15 slots.
 * Migrations keep the original URL: multi-statement files need session mode.
 */
export function pooledConnectionString(connectionString: string): string {
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

export function remotePoolConfig(connectionString: string) {
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  return {
    connectionString: pooledConnectionString(connectionString),
    // One socket for this process. Auth and app queries share it, and a warm
    // instance must not hold a handful of idle clients the way `max: 3` did.
    max: 1,
    idleTimeoutMillis: 1000,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 8000,
    ssl: local ? undefined : { rejectUnauthorized: false as const },
  };
}

/**
 * The one Postgres pool for this process. Better Auth and `getSql()` both use
 * it. A second pool doubled the clients each serverless instance held open.
 */
export function getSharedPgPool(connectionString: string): Pool {
  if (!globalPool.__aviatorPgParsers__) {
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, (value: string) => value);
    types.setTypeParser(OID_INTERVAL, (value: string) => value);
    globalPool.__aviatorPgParsers__ = true;
  }
  globalPool.__aviatorPgPool__ ??= new Pool(remotePoolConfig(connectionString));
  return globalPool.__aviatorPgPool__;
}
