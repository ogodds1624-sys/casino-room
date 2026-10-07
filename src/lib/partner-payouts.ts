import { createServerFn } from "@tanstack/react-start";
import { validatePayoutRecipient, type PayoutCurrency, type PayoutRecipient } from "./payout-types";

function partnerInput(data: { token: string }) {
  const token = data?.token?.trim() ?? "";
  if (!token) throw new Error("Sign in again.");
  return { token };
}

function adminInput(data: { adminToken: string }) {
  const adminToken = data?.adminToken?.trim() ?? "";
  if (!adminToken) throw new Error("Sign in as an admin.");
  return { adminToken };
}

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => {
    const passcode = data?.passcode?.trim() ?? "";
    if (!passcode || passcode.length > 256) throw new Error("Enter your admin passcode.");
    return { passcode };
  })
  .handler(async ({ data }) => {
    const { signInAdmin } = await import("./admin-access.server");
    return { token: signInAdmin(data.passcode) };
  });

export const checkAdminSession = createServerFn({ method: "POST" })
  .inputValidator(adminInput)
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-access.server");
    requireAdminSession(data.adminToken);
    return { valid: true };
  });

export const getPartnerPayouts = createServerFn({ method: "POST" })
  .inputValidator(partnerInput)
  .handler(async ({ data }) => {
    const { readPartnerPortal } = await import("./admin-snapshot");
    const { getPayoutSql, readPartnerPayouts } = await import("./partner-payouts.server");
    const sql = await getPayoutSql();
    const portal = await readPartnerPortal(sql, data.token);
    return { balances: portal.payoutBalances, requests: await readPartnerPayouts(sql, data.token) };
  });

export const requestPartnerPayout = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; currency: PayoutCurrency; earningDay: string; recipient: PayoutRecipient }) => {
    const { token } = partnerInput(data);
    if (data.currency !== "GHS" && data.currency !== "NGN") throw new Error("Choose Ghana or Nigeria earnings.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.earningDay ?? "")) throw new Error("Missing earnings date.");
    const recipient = validatePayoutRecipient(data.recipient);
    return { token, currency: data.currency, earningDay: data.earningDay, recipient };
  })
  .handler(async ({ data }) => {
    const { readPartnerPortal } = await import("./admin-snapshot");
    const { getPayoutSql, createPayoutRequest, readPartnerPayouts } = await import("./partner-payouts.server");
    const sql = await getPayoutSql();
    const portal = await readPartnerPortal(sql, data.token);
    const balance = portal.payoutBalances.find((item) => item.currency === data.currency && item.earningDay === data.earningDay);
    if (!balance) throw new Error("You can only request yesterday's earnings. Refresh and try again.");
    await createPayoutRequest(sql, data.token, balance, data.recipient);
    return { balances: portal.payoutBalances, requests: await readPartnerPayouts(sql, data.token) };
  });

export const getAdminPayouts = createServerFn({ method: "POST" })
  .inputValidator(adminInput)
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-access.server");
    requireAdminSession(data.adminToken);
    const { getPayoutSql, readAdminPayouts } = await import("./partner-payouts.server");
    return readAdminPayouts(await getPayoutSql());
  });

export const markPartnerYesterdayPaid = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; partnerId: string }) => {
    const { adminToken } = adminInput(data);
    const partnerId = data?.partnerId?.trim() ?? "";
    if (!partnerId) throw new Error("Choose a partner.");
    return { adminToken, partnerId };
  })
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-access.server");
    requireAdminSession(data.adminToken);
    const { getPayoutSql, markPartnerYesterdayPaid: settleYesterday } = await import("./partner-payouts.server");
    await settleYesterday(await getPayoutSql(), data.partnerId);
    return { ok: true };
  });

export const reviewPartnerPayout = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string; status: "paid" | "rejected"; note: string; transferReference?: string }) => {
    const { adminToken } = adminInput(data);
    if (!data?.id) throw new Error("Missing payout request.");
    if (data.status !== "paid" && data.status !== "rejected") throw new Error("Choose a valid payout action.");
    const note = data.note?.trim() ?? "";
    if (note.length > 500) throw new Error("Keep the review note under 500 characters.");
    if (data.status === "rejected" && !note) throw new Error("Enter a reason for rejecting this payout.");
    const transferReference = data.transferReference?.trim() ?? "";
    if (transferReference.length > 150 || (data.status === "paid" && !transferReference)) throw new Error("Enter a transfer reference of up to 150 characters.");
    return { adminToken, id: data.id, status: data.status, note, transferReference };
  })
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-access.server");
    requireAdminSession(data.adminToken);
    const { getPayoutSql, readAdminPayouts, reviewPayoutRequest } = await import("./partner-payouts.server");
    const sql = await getPayoutSql();
    await reviewPayoutRequest(sql, data.id, data.status, data.note, data.transferReference);
    return readAdminPayouts(sql);
  });
