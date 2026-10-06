export type PayoutCurrency = "GHS" | "NGN";
export type PayoutStatus = "pending" | "paid" | "rejected";
export const PAYOUT_MOMO_PROVIDERS = ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money"] as const;
export type PayoutRecipient = {
  method: "mobile_money" | "bank";
  provider: string;
  accountName: string;
  accountNumber: string;
};

export function validatePayoutRecipient(value: unknown, currency: PayoutCurrency): PayoutRecipient {
  if (!value || typeof value !== "object") throw new Error("Enter your receiving details.");
  const { method, provider, accountName, accountNumber } = value as Record<string, unknown>;
  if (method !== "bank" && method !== "mobile_money") throw new Error("Choose a receiving method.");
  if (currency === "NGN" && method !== "bank") throw new Error("Nigeria payouts require a bank account.");
  if (typeof provider !== "string" || provider.trim().length < 2 || provider.trim().length > 100) throw new Error("Enter a valid bank or mobile money provider.");
  if (method === "mobile_money" && !PAYOUT_MOMO_PROVIDERS.some((name) => name === provider)) throw new Error("Choose a Ghana mobile money provider.");
  if (typeof accountName !== "string" || accountName.trim().length < 2 || accountName.trim().length > 100) throw new Error("Enter the account holder's name.");
  if (typeof accountNumber !== "string") throw new Error("Enter the receiving account number.");
  const number = accountNumber.trim();
  const valid = method === "mobile_money" ? /^0\d{9}$/.test(number) : currency === "NGN" ? /^\d{10}$/.test(number) : /^\d{6,20}$/.test(number);
  if (!valid) throw new Error(method === "mobile_money" ? "Enter a 10-digit Ghana mobile money number starting with 0." : currency === "NGN" ? "Enter a 10-digit Nigeria bank account number." : "Enter a bank account number of 6 to 20 digits.");
  return { method, provider: provider.trim(), accountName: accountName.trim(), accountNumber: number };
}

export type PayoutRequest = {
  id: string;
  partnerName: string;
  partnerEmail: string;
  earningDay: string;
  currency: PayoutCurrency;
  grossAmount: number;
  commission: number;
  amount: number;
  status: PayoutStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string;
  recipient: PayoutRecipient | null;
  transferReference: string;
};

export type PayoutBalance = {
  earningDay: string;
  currency: PayoutCurrency;
  grossAmount: number;
  commission: number;
  amount: number;
};

export function payoutMoney(amount: number, currency: PayoutCurrency) {
  return `${currency === "NGN" ? "₦" : "GHS "}${amount.toLocaleString(currency === "NGN" ? "en-NG" : "en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
