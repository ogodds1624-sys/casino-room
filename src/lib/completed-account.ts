import { createServerFn } from "@tanstack/react-start";

const SESSION_COOKIE = "__Host-grok-auth.session_token";

/** Reports whether the signed-in account has finished SportyBet. It does not end the session. */
export const enforceCompletedAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const request = getRequest();
  const hasSessionCookie = (request?.headers.get("cookie") ?? "").includes(`${SESSION_COOKIE}=`);
  const user = await getSessionUser(undefined, { includeBlocked: true });
  // A blocked account stays on the front page rather than being cleared as stale.
  if (user?.blocked) return { signedIn: true, completed: true, stale: false };
  if (!user) return { signedIn: false, completed: false, stale: hasSessionCookie };
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  try {
    const rows = await sql<{ completed: boolean }>`
      select "isCompleted" as completed from "user" where id = ${user.id} limit 1
    `;
    const value = rows[0]?.completed as unknown;
    const completed = value === true || value === "t" || value === "true" || value === 1;
    return { signedIn: true, completed, stale: false };
  } catch {
    return { signedIn: true, completed: true, stale: false };
  }
});
