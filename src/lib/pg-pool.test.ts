import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pooledConnectionString } from "./pg-pool.ts";

describe("pooledConnectionString", () => {
  it("moves the Supabase session pooler to transaction mode", () => {
    const url =
      "postgresql://postgres.abc:s3cret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
    assert.equal(
      pooledConnectionString(url),
      "postgresql://postgres.abc:s3cret@aws-1-eu-central-1.pooler.supabase.com:6543/postgres",
    );
  });

  it("adds the transaction port when the session URL omits it", () => {
    const url = "postgres://postgres.abc:s3cret@aws-0-eu-west-1.pooler.supabase.co/postgres?sslmode=require";
    assert.equal(
      pooledConnectionString(url),
      "postgres://postgres.abc:s3cret@aws-0-eu-west-1.pooler.supabase.co:6543/postgres?sslmode=require",
    );
  });

  it("keeps a URL that is already on the transaction port", () => {
    const url = "postgresql://postgres.abc:s3cret@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";
    assert.equal(pooledConnectionString(url), url);
  });

  it("keeps a direct Supabase host and other databases on their own port", () => {
    const direct = "postgresql://postgres:s3cret@db.abc.supabase.co:5432/postgres";
    const neon = "postgresql://user:s3cret@ep-example.us-east-2.aws.neon.tech/neondb";
    const local = "postgresql://user:s3cret@localhost:5432/app";
    assert.equal(pooledConnectionString(direct), direct);
    assert.equal(pooledConnectionString(neon), neon);
    assert.equal(pooledConnectionString(local), local);
  });

  it("uses the last @ so a password can contain one", () => {
    const url = "postgresql://postgres.abc:p@ss@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
    assert.equal(
      pooledConnectionString(url),
      "postgresql://postgres.abc:p@ss@aws-1-eu-central-1.pooler.supabase.com:6543/postgres",
    );
  });
});
