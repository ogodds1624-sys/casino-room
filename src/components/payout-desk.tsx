import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getAdminPayouts, getPartnerPayouts, requestPartnerPayout, reviewPartnerPayout } from "@/lib/partner-payouts";
import { payoutMoney, type PayoutRequest } from "@/lib/payout-types";

function useLivePayouts<T>(load: () => Promise<T>, refreshVersion = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef({ value: 0 });
  const reload = useCallback(async () => {
    const pending = sequence.current;
    const current = ++pending.value;
    try {
      const result = await load();
      if (pending.value === current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (pending.value === current) setError(err instanceof Error ? err.message : "Could not load payouts.");
    }
  }, [load]);
  useEffect(() => {
    const pending = sequence.current;
    void reload();
    const timer = window.setInterval(() => void reload(), 3000);
    return () => {
      ++pending.value;
      window.clearInterval(timer);
    };
  }, [reload, refreshVersion]);
  return { data, error, reload };
}

const panel = "rounded-3xl border border-white/10 bg-[#111111] p-5";
const actionClass = "min-h-11 rounded-xl bg-red px-4 py-3 text-xs font-extrabold tracking-wide text-white disabled:opacity-50";
const inputClass = "min-h-11 w-full rounded-xl border border-white/15 bg-ink px-3 py-3 text-sm text-white outline-none focus:border-red";

function PayoutHistory({ rows, admin = false, children }: {
  rows: PayoutRequest[];
  admin?: boolean;
  children?: (row: PayoutRequest) => ReactNode;
}) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className={panel + " text-sm text-[#9aa3b2]"}>No payout requests yet.</p> : rows.map((row) => (
        <article key={row.id} className={panel}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {admin ? <><h3 className="break-words font-extrabold">{row.partnerName}</h3><p className="break-all text-sm text-[#9aa3b2]">{row.partnerEmail}</p></> : null}
              <p className="mt-1 text-sm text-[#9aa3b2]">Earnings date: {row.earningDay} · {row.currency === "GHS" ? "Ghana" : "Nigeria"}</p>
              <p className="mt-2 text-xl font-black text-gold">{payoutMoney(row.amount, row.currency)}</p>
            </div>
            <span className={"rounded-full border px-3 py-1 text-xs font-extrabold uppercase " + (row.status === "paid" ? "border-green-400/40 text-green-400" : row.status === "rejected" ? "border-red/40 text-red" : "border-gold/40 text-gold")}>{row.status}</span>
          </div>
          <p className="mt-3 text-sm text-[#9aa3b2]">{payoutMoney(row.grossAmount, row.currency)} gross − {row.commission}% commission</p>
          <p className="mt-1 text-xs text-[#9aa3b2]">Requested {new Date(row.createdAt).toLocaleString()}</p>
          {row.reviewedAt ? <p className="mt-1 text-xs text-[#9aa3b2]">Reviewed {new Date(row.reviewedAt).toLocaleString()}</p> : null}
          {row.reviewNote ? <p className="mt-3 break-words text-sm text-white">Admin note: {row.reviewNote}</p> : null}
          {children?.(row)}
        </article>
      ))}
    </div>
  );
}

export function PartnerPayoutDesk({ token }: { token: string }) {
  const load = useCallback(() => getPartnerPayouts({ data: { token } }), [token]);
  const { data, error, reload } = useLivePayouts(load);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function request(balance: NonNullable<typeof data>["balances"][number]) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await requestPartnerPayout({ data: { token, currency: balance.currency, earningDay: balance.earningDay } });
      await reload();
      setNotice("Payout request sent. Your admin will review it.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not request your payout.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <h2 className="text-2xl font-black">Yesterday's payout</h2>
        <p className="mt-2 text-sm text-[#9aa3b2]">Request your net earnings from yesterday's confirmed referrals. Ghana uses Accra time; Nigeria uses Lagos time.</p>
        <p className="mt-2 text-sm text-[#9aa3b2]">One request per day and currency. Payments are sent manually by your admin, not automatically.</p>
      </div>
      {error || actionError ? <p role="alert" className="text-sm text-red">{actionError ?? error}</p> : null}
      {notice ? <p role="status" className="text-sm text-green-400">{notice}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-[#9aa3b2]">Loading payout earnings...</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.balances.map((balance) => {
          const existing = data.requests.find((row) => row.earningDay === balance.earningDay && row.currency === balance.currency && row.status !== "rejected");
          return (
            <section key={balance.currency} className={panel}>
              <h3 className="text-sm font-extrabold tracking-wide">{balance.currency === "GHS" ? "GHANA" : "NIGERIA"} · {balance.earningDay}</h3>
              <p className="mt-3 text-3xl font-black text-gold">{payoutMoney(balance.amount, balance.currency)}</p>
              <p className="mt-2 text-sm text-[#9aa3b2]">{payoutMoney(balance.grossAmount, balance.currency)} gross − {balance.commission}% commission</p>
              <button type="button" disabled={busy || Boolean(existing) || balance.amount <= 0 || Boolean(error)} onClick={() => void request(balance)} className={actionClass + " mt-4 w-full"}>
                {existing ? (existing.status === "paid" ? "ALREADY PAID" : "REQUEST PENDING") : balance.amount <= 0 ? "NO EARNINGS YESTERDAY" : busy ? "SENDING..." : `REQUEST ${balance.currency} PAYOUT`}
              </button>
            </section>
          );
        })}
      </div>
      <h2 className="text-xl font-black">Your payout history</h2>
      {data ? <PayoutHistory rows={data.requests} /> : null}
    </div>
  );
}

export function AdminPayoutDesk({ adminToken, refreshVersion = 0 }: { adminToken: string; refreshVersion?: number }) {
  const load = useCallback(() => getAdminPayouts({ data: { adminToken } }), [adminToken]);
  const { data, error, reload } = useLivePayouts(load, refreshVersion);
  const [filter, setFilter] = useState<"all" | PayoutRequest["status"]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function review(row: PayoutRequest, status: "paid" | "rejected") {
    if (submitting.current) return;
    const note = notes[row.id]?.trim() ?? "";
    if (status === "rejected" && !note) {
      setActionError("Enter a reason before rejecting a payout.");
      return;
    }
    if (status === "paid" && !window.confirm(`Confirm you have already sent ${payoutMoney(row.amount, row.currency)} to ${row.partnerName}. This only records the payment; it does not transfer funds.`)) return;
    submitting.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await reviewPartnerPayout({ data: { adminToken, id: row.id, status, note } });
      await reload();
      setNotice(status === "paid" ? "Payout marked paid." : "Payout rejected. The partner can see your reason.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not review this payout.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-2xl font-black">Partner payout requests</h2>
      <p className="text-sm text-[#9aa3b2]">Review yesterday's net earnings requests. Send the payout manually before marking it paid. Submitted amounts and commission rates are saved for your records.</p>
      <div className="flex flex-wrap gap-2">
        {(["pending", "paid", "rejected", "all"] as const).map((status) => (
          <button key={status} type="button" onClick={() => setFilter(status)} className={"min-h-11 rounded-xl px-4 text-xs font-extrabold uppercase " + (filter === status ? "bg-red text-white" : "border border-white/15 text-[#9aa3b2]")}>
            {status} ({data?.filter((row) => status === "all" || row.status === status).length ?? 0})
          </button>
        ))}
      </div>
      {error || actionError ? <p role="alert" className="text-sm text-red">{actionError ?? error}</p> : null}
      {notice ? <p role="status" className="text-sm text-green-400">{notice}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-[#9aa3b2]">Loading payout requests...</p> : null}
      {data ? <PayoutHistory rows={data.filter((row) => filter === "all" || row.status === filter)} admin>
        {(row) => row.status === "pending" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-[#9aa3b2]">
              Payment reference or rejection reason
              <textarea value={notes[row.id] ?? ""} maxLength={500} disabled={busy} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} className={inputClass + " mt-2"} placeholder="Required when rejecting; optional payment reference when paid" />
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={busy || Boolean(error)} onClick={() => void review(row, "paid")} className={actionClass}>MARK PAID</button>
              <button type="button" disabled={busy || Boolean(error)} onClick={() => void review(row, "rejected")} className="min-h-11 rounded-xl border border-red px-4 text-xs font-extrabold text-red disabled:opacity-50">REJECT REQUEST</button>
            </div>
          </div>
        ) : null}
      </PayoutHistory> : null}
    </div>
  );
}
