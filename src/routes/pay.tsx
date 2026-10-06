import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { SignalLoading } from "@/components/signal-loading";
import { getPaymentStatus, getSportyLink, recordPayment } from "@/lib/admin-snapshot";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLiveStorefront } from "@/lib/storefront-live";
import { clearPendingPayment, confirmPendingPayment, readPendingPayment, savePendingPayment } from "@/lib/desk-session";
import { rememberReferral, storedReferral } from "@/lib/remember-ref";
import { openTask } from "@/lib/task-order";

export const Route = createFileRoute("/pay")({
  validateSearch: (search: Record<string, unknown>) => {
    const amount = Number(search.amount);
    return { amount: amount === 350 || amount === 400 || amount === 500 || amount === 800 || amount === 1700 ? amount : 350 };
  },
  component: PayPage,
});

function PayPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const { amount } = Route.useSearch();
  const store = useLiveStorefront();
  const userId = user?.id ?? "";
  const devFallback = user?.isDevFallback === true;
  const [allowed, setAllowed] = useState(false);
  const [choice, setChoice] = useState(0);
  const [receipt, setReceipt] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [result, setResult] = useState<"pending" | "confirmed" | "rejected">("pending");

  useEffect(() => {
    if (isPending) return;
    let stop = false;
    void getSportyLink()
      .then((link) => {
        if (stop) return;
        if (!link.signedIn || devFallback) {
          void navigate({ to: "/register", viewTransition: false });
          return;
        }
        if (!link.linked) {
          void openTask(navigate, link);
          return;
        }
        if (link.country === "Nigeria") {
          void navigate({ to: "/nigeria-pay", viewTransition: false });
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (stop) return;
        setError("Could not open checkout. Go back and choose the package again.");
      });
    return () => {
      stop = true;
    };
  }, [isPending, userId, devFallback, navigate]);

  useEffect(() => {
    if (!allowed || paymentId) return;
    const saved = readPendingPayment();
    if (!saved) return;
    if (saved.amount !== amount) {
      void navigate({ to: "/pay", search: { amount: saved.amount }, replace: true, viewTransition: false });
      return;
    }
    let stop = false;
    void getPaymentStatus({ data: { id: saved.id } })
      .then((row) => {
        if (stop) return;
        if (row.status === "rejected") {
          clearPendingPayment();
          setResult("rejected");
          setPaymentId(saved.id);
        } else {
          setPaymentId(saved.id);
          if (row.status === "confirmed") setResult("confirmed");
        }
      })
      .catch(() => {
        // Keep the saved payment so the next visit can resume waiting.
      });
    return () => {
      stop = true;
    };
  }, [allowed, amount, paymentId, navigate]);

  useEffect(() => {
    if (!paymentId || result !== "pending") return;
    const timer = window.setInterval(() => {
      void getPaymentStatus({ data: { id: paymentId } }).then((row) => {
        if (row.status === "confirmed" || row.status === "rejected") setResult(row.status);
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paymentId, result]);

  useEffect(() => {
    if (result === "confirmed") {
      const timer = window.setTimeout(() => {
        clearPendingPayment();
        void navigate({ to: "/session" });
      }, confirmPendingPayment(paymentId ?? "", amount));
      return () => window.clearTimeout(timer);
    }
    if (result === "rejected") {
      clearPendingPayment();
      void navigate({ to: "/packages", search: { rejected: 1 }, viewTransition: false });
    }
  }, [result, amount, navigate]);

  const options = [
    ...(store?.wallets ?? []).map((wallet) => ({
      kind: "momo" as const,
      label: wallet.network,
      number: wallet.number,
      name: wallet.name,
    })),
    ...(store?.banks ?? []).map((account) => ({
      kind: "bank" as const,
      label: account.bank || "Bank transfer",
      number: account.number,
      name: account.name,
    })),
  ];
  const selected = options[choice] ?? options[0];

  function copyNumber() {
    if (!selected) return;
    const field = document.createElement("textarea");
    field.value = selected.number;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.opacity = "0";
    document.body.append(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, selected.number.length);
    const ok = document.execCommand("copy");
    field.remove();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      return;
    }
    void navigator.clipboard.writeText(selected.number).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  function onReceipt(file: File | undefined) {
    if (!file) {
      setReceipt("");
      setReceiptName("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceipt(typeof reader.result === "string" ? reader.result : "");
      setReceiptName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!receipt) {
      setError("Attach a screenshot of your payment.");
      return;
    }
    setError(null);
    try {
      await rememberReferral();
      const saved = await recordPayment({ data: { name: "", amount, receipt, referredBy: storedReferral() } });
      setPaymentId(saved.id);
      savePendingPayment(saved.id, amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that payment.");
    }
  }

  const waitingLabel =
    result === "confirmed" ? "your network is connecting to the hack server" : result === "rejected" ? "payment rejected" : "waiting for confirmation";

  return (
    <main className="home-theme flex min-h-dvh items-start justify-center px-3 py-6 text-white sm:items-center">
      {result === "rejected" ? (
        <div className="reject-alert fixed inset-0 z-50 grid place-items-center bg-black/80 px-6" role="alert">
          <div className="reject-card w-full max-w-sm rounded-3xl border border-red bg-[#140606] px-5 py-7 text-center">
            <p className="text-xs font-extrabold tracking-[0.2em] text-red">PAYMENT REJECTED</p>
            <p className="mt-3 text-2xl font-extrabold">Your payment was rejected</p>
            <p className="mt-2 text-sm text-white/70">Sending you back to the packages page.</p>
          </div>
        </div>
      ) : paymentId ? (
        <SignalLoading label={waitingLabel} />
      ) : null}
      <section className="auth-card w-full max-w-md rounded-[28px] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-extrabold tracking-[0.18em] text-white">
            {selected?.kind === "bank" ? "BANK TRANSFER" : "MOBILE MONEY"}
          </p>
          <Link
            to="/packages"
            aria-label="Close"
            className="grid size-9 place-items-center rounded-xl border border-line text-white no-underline"
          >
            <X className="size-4" aria-hidden />
          </Link>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          {selected?.kind === "bank" ? "Pay by bank transfer" : "Pay by MoMo transfer"}
        </h1>
        <p className="mt-1 text-sm text-white/70">{store?.businessName ?? "Casino"}</p>
        <p className="mt-3 text-4xl font-extrabold tracking-tight text-gold">
          GHS {amount.toLocaleString("en-GH")}
        </p>

        {!store ? (
          <p className="mt-6 text-sm text-white/70">Loading checkout…</p>
        ) : !selected ? (
          <p className="mt-6 text-sm text-white/70">
            Checkout is not ready yet. Save a wallet or bank account on the admin payment gateway.
          </p>
        ) : (
          <>
            {options.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {options.map((option, index) => (
                  <button
                    key={`${option.kind}-${option.number}`}
                    type="button"
                    onClick={() => setChoice(index)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-extrabold " +
                      (index === choice ? "border-red bg-red text-white" : "border-line text-white")
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <dl className="mt-5 overflow-hidden rounded-2xl border border-line">
              <div className="flex items-center justify-between gap-3 px-4 py-4">
                <dt className="text-xs font-bold tracking-widest text-white">
                  {selected.kind === "bank" ? "BANK" : "NETWORK"}
                </dt>
                <dd className="text-right text-base font-bold">{selected.label}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-4">
                <dt className="text-xs font-bold tracking-widest text-white">SEND TO</dt>
                <dd className="flex items-center gap-2 text-base font-extrabold">
                  <span>{selected.number}</span>
                  <button
                    type="button"
                    onClick={copyNumber}
                    className="rounded-lg border border-red px-2 py-1 text-[11px] font-extrabold tracking-wide text-white"
                  >
                    {copied ? "COPIED" : "COPY"}
                  </button>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-4">
                <dt className="text-xs font-bold tracking-widest text-white">NAME</dt>
                <dd className="text-right text-sm font-extrabold tracking-wide">{selected.name || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-4">
                <dt className="text-xs font-bold tracking-widest text-white">AMOUNT</dt>
                <dd className="text-base font-extrabold text-gold">
                  GHS {amount.toLocaleString("en-GH")}
                </dd>
              </div>
            </dl>

            <ol className="mt-5 space-y-4 text-base leading-relaxed text-white">
              <li>
                1. Send <strong className="text-gold">GHS {amount.toLocaleString("en-GH")}</strong> to the{" "}
                <strong>{selected.label}</strong> details above.
              </li>
              <li>2. Attach a screenshot of your payment.</li>
              <li>3. An admin confirms it under Transactions. This page updates when they do.</li>
            </ol>

            {paymentId ? null : (
              <form onSubmit={onSubmit} className="mt-6">
                <label htmlFor="receipt" className="text-xs font-extrabold tracking-[0.14em] text-white">
                  PAYMENT SCREENSHOT
                </label>
                <input
                  id="receipt"
                  type="file"
                  accept="image/*,.pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => onReceipt(event.target.files?.[0])}
                  className="mt-3 w-full rounded-xl border border-line bg-ink px-3 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-sm file:font-bold file:text-white"
                />
                <p className="mt-2 text-sm text-white/60">{receiptName || "no file selected"}</p>
                {error ? <p className="mt-2 text-sm text-red">{error}</p> : null}
                <button
                  type="submit"
                  disabled={!allowed}
                  className="mt-4 flex h-14 w-full items-center justify-center rounded-xl bg-red text-base font-extrabold tracking-wide text-white disabled:opacity-70"
                >
                  I'VE SENT THE MONEY
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
