import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Flame, Gem, X, Zap } from "lucide-react";
import { getPaymentStatus, getSportyLink, recordPayment } from "@/lib/admin-snapshot";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLiveStorefront } from "@/lib/storefront-live";
import { PlaneSky } from "@/components/plane-sky";
import { SignalLoading } from "@/components/signal-loading";
import { startSession } from "@/lib/desk-session";
import { rememberReferral, storedReferral } from "@/lib/remember-ref";
import { openTask } from "@/lib/task-order";

export const Route = createFileRoute("/nigeria-pay")({
  component: NigeriaPayPage,
});

const PACKAGES = [
  { price: 35000, detail: "3 mins per session", icon: Zap },
  { price: 55000, detail: "5 mins per session", icon: Flame },
  { price: 75000, detail: "7 mins per session", icon: Gem },
] as const;

function naira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function NigeriaPayPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? "";
  const devFallback = user?.isDevFallback === true;
  const store = useLiveStorefront();
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState(0);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<35000 | 55000 | 75000 | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiptName, setReceiptName] = useState("");
  const [receipt, setReceipt] = useState("");
  const [alertOn, setAlertOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [result, setResult] = useState<"pending" | "confirmed" | "rejected">("pending");

  useEffect(() => {
    if (isPending) return;
    let stop = false;
    void getSportyLink().then((link) => {
      if (stop) return;
      if (!link.signedIn || devFallback) {
        void navigate({ to: "/register" });
        return;
      }
      if (!link.linked) {
        void openTask(navigate, link);
        return;
      }
      if (link.country !== "Nigeria") {
        void navigate({ to: "/packages", viewTransition: false });
        return;
      }
      setReady(true);
    });
    return () => {
      stop = true;
    };
  }, [isPending, userId, devFallback, navigate]);

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
    if (!amount) return;
    if (result === "confirmed") {
      startSession(amount);
      void navigate({ to: "/session" });
      return;
    }
    if (result === "rejected") {
      setWaiting(false);
      setPaymentId(null);
      setResult("pending");
      setShowPay(false);
      setAmount(null);
      setAlertOn(true);
    }
  }, [result, amount, navigate]);

  const accounts = store?.nigeriaAccounts ?? [];
  const selected = accounts[choice] ?? accounts[0];
  const open = Boolean(store?.nigeriaOn && selected);

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
    if (!open || amount == null) return;
    const payer = name.trim();
    if (payer.length < 3) {
      setError("Enter the name on the account you sent from.");
      return;
    }
    setError(null);
    try {
      await rememberReferral();
      const saved = await recordPayment({ data: { name: payer, amount, receipt, referredBy: storedReferral() } });
      setPaymentId(saved.id);
      setWaiting(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that payment.");
    }
  }

  const waitingLabel =
    result === "confirmed" ? "payment confirmed" : result === "rejected" ? "payment rejected" : "waiting for confirmation";

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink">
        <SignalLoading />
      </main>
    );
  }

  if (amount == null || !showPay) {
    return (
      <main className="relative min-h-dvh overflow-hidden px-4 py-10 text-white">
        <PlaneSky />
        <div className="relative z-10 mx-auto w-full max-w-md">
          {alertOn ? (
            <div className="reject-banner mb-5 rounded-2xl border border-red bg-black/75 px-4 py-4 text-center" role="alert">
              <p className="text-sm font-extrabold tracking-wide text-red">PAYMENT REJECTED</p>
              <p className="mt-1 text-base font-bold text-white">Your payment was rejected. Choose a package and try again.</p>
            </div>
          ) : null}
          <Link
            to="/"
            className="mb-4 inline-flex h-7 items-center justify-center rounded-lg border border-white/5 bg-black/20 px-2 text-[10px] font-bold tracking-wide text-white/25 no-underline"
          >
            ← BACK HOME
          </Link>
          <h1 className="text-center text-3xl font-extrabold tracking-tight text-gold [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            Choose Your Package
          </h1>
          <p className="mt-2 text-center text-base font-extrabold text-gold [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            Buy session time · Use anytime
          </p>
          {error ? <p className="mt-4 text-center text-sm font-bold text-red">{error}</p> : null}
          <div className="mt-6 space-y-4">
            {PACKAGES.map((pack, index) => {
              const Icon = pack.icon;
              return (
                <article key={pack.price} className="rounded-3xl border border-line bg-panel px-4 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-3xl font-extrabold tracking-tight text-[#3dde6a]">{naira(pack.price)}</h2>
                      <span className="rounded-full border border-red px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-red">
                        AVAILABLE
                      </span>
                    </div>
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red/15 text-red">
                      <Icon className="size-5" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-white">{pack.detail}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setAmount(pack.price);
                      setShowPay(true);
                    }}
                    style={{ animationDelay: `${index * 0.2}s` }}
                    className="buy-pulse mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red text-base font-extrabold tracking-wide text-white disabled:opacity-70"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ArrowRight className="size-4" aria-hidden />
                      GET {naira(pack.price)}
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-start justify-center bg-ink px-3 py-6 text-white sm:items-center">
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
      <section className="w-full max-w-md rounded-[28px] border border-line bg-panel px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-extrabold tracking-[0.18em] text-red">BANK TRANSFER</p>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setShowPay(false);
              setAmount(null);
            }}
            className="grid size-9 place-items-center rounded-xl border border-line text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Pay by bank transfer</h1>
        <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#3dde6a]">{naira(amount)} NGN</p>
        {!store ? (
          <p className="mt-6 text-sm text-white/70">Loading checkout…</p>
        ) : !open || !selected ? (
          <p className="mt-6 text-sm text-white/70">
            Checkout is not ready yet. Turn on the Nigeria payment gateway and save an account.
          </p>
        ) : (
          <>
            {accounts.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {accounts.map((account, index) => (
                  <button
                    key={`${account.number}-${index}`}
                    type="button"
                    onClick={() => setChoice(index)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-extrabold " +
                      (index === choice ? "border-red bg-red text-white" : "border-line text-white")
                    }
                  >
                    {account.bank || "Account"}
                  </button>
                ))}
              </div>
            ) : null}
            <dl className="mt-5 overflow-hidden rounded-2xl border border-line">
              <div className="flex items-center justify-between gap-3 px-4 py-4">
                <dt className="text-xs font-bold tracking-widest text-white">BANK</dt>
                <dd className="text-right text-base font-bold">{selected.bank || "Bank"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-4">
                <dt className="text-xs font-bold tracking-widest text-white">ACCOUNT NUMBER</dt>
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
                <dt className="text-xs font-bold tracking-widest text-white">ACCOUNT NAME</dt>
                <dd className="text-right text-sm font-extrabold tracking-wide">{selected.name || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-4">
                <dt className="text-xs font-bold tracking-widest text-white">AMOUNT</dt>
                <dd className="text-base font-extrabold">{naira(amount)} NGN</dd>
              </div>
            </dl>
            <ol className="mt-5 space-y-4 text-base leading-relaxed text-white">
              <li>
                1. Transfer <strong>{naira(amount)} NGN</strong> to the account above from your banking app.
              </li>
              <li>
                2. Attach a <strong>screenshot of the receipt</strong> — your Casino signal is opened once the payment is
                confirmed.
              </li>
            </ol>
            <form onSubmit={(event) => void onSubmit(event)} className="mt-6">
              <label htmlFor="receipt" className="text-xs font-extrabold tracking-[0.14em] text-white">
                RECEIPT SCREENSHOT
              </label>
              <input
                id="receipt"
                type="file"
                accept="image/*,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => onReceipt(event.target.files?.[0])}
                className="mt-3 w-full rounded-xl border border-line bg-ink px-3 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-sm file:font-bold file:text-white"
              />
              <p className="mt-2 text-sm text-white/60">{receiptName || "no file selected"}</p>
              <p className="mt-1 text-xs text-white/50">Any screenshot size is accepted, including files over 1MB.</p>
              <label htmlFor="sender-name" className="mt-5 block text-xs font-extrabold tracking-[0.14em] text-white">
                NAME ON THE TRANSFER
              </label>
              <input
                id="sender-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Frank Kalaba"
                autoComplete="name"
                className="mt-3 h-14 w-full rounded-xl border border-line bg-ink px-4 text-base text-white outline-none placeholder:text-white/40"
              />
              {error ? <p className="mt-2 text-sm text-red">{error}</p> : null}
              <button
                type="submit"
                className="mt-4 flex h-14 w-full items-center justify-center rounded-xl bg-red text-base font-extrabold tracking-wide text-white"
              >
                I'VE SENT THE MONEY
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
