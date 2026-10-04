import { createServerFn } from "@tanstack/react-start";

/** Read-only check. It does not insert a user or an email row. */
export const peekRegistrationEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email?: string }) => {
    const email = data?.email?.trim().toLowerCase() ?? "";
    if (!email.includes("@")) throw new Error("Enter a valid email.");
    return { email };
  })
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ id: string }>`select id from "user" where lower(email) = ${data.email} limit 1`;
    return { taken: rows.length > 0 };
  });
