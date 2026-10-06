import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_SECONDS = 8 * 60 * 60;

function adminPasscode() {
  const passcode = process.env.ADMIN_PASSCODE?.trim();
  if (!passcode) throw new Error("Admin sign-in is not configured. Set ADMIN_PASSCODE on the server.");
  return passcode;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function signature(payload: string) {
  return createHmac("sha256", adminPasscode()).update(`casino-admin:${payload}`).digest("base64url");
}

export function signInAdmin(passcode: string, now = Date.now()) {
  if (!timingSafeEqual(digest(passcode), digest(adminPasscode()))) throw new Error("Wrong passcode.");
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}

export function requireAdminSession(token: string, now = Date.now()) {
  const [expires, nonce, signed, extra] = token.split(".");
  const expiry = Number(expires);
  if (extra || !nonce || !signed || !Number.isInteger(expiry) || expiry <= Math.floor(now / 1000)) {
    throw new Error("Admin session expired. Sign in again.");
  }
  const expected = signature(`${expires}.${nonce}`);
  if (!timingSafeEqual(digest(signed), digest(expected))) throw new Error("Admin session expired. Sign in again.");
}
