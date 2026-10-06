export type PayoutCurrency = "GHS" | "NGN";
export type PayoutStatus = "pending" | "paid" | "rejected";

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
