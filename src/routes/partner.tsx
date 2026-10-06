import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, CircleDollarSign, Copy, Diamond, LayoutGrid, Star, Users, Wallet } from "lucide-react";
import { PartnerPayoutDesk } from "@/components/payout-desk";
import { SignalLoading } from "@/components/signal-loading";
import { applyPartner, getPartnerGate, getPartnerPortal, partnerLogin, type PartnerPortal } from "@/lib/admin-snapshot";

export const Route = createFileRoute("/partner")({
  component: PartnersPage,
});

const TOKEN_KEY = "aviator-partner";

function PartnersPage() {
  const [token, setToken] = useState<string | null>(null);
  const [portal, setPortal] = useState<PartnerPortal | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [desk, setDesk] = useState<"overview" | "referrals" | "payouts">("overview");
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"sign" | "apply">("sign");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [applied, setApplied] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY);
    if (saved) {
      window.localStorage.setItem(TOKEN_KEY, saved);
      window.sessionStorage.setItem(TOKEN_KEY, saved);
    }
    setToken(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    let live = true;
    const check = () => {
      void getPartnerGate({ data: { token } })
        .then(async (gate) => {
          if (!live) return;
          if (gate.status === "approved") {
            const data = await getPartnerPortal({ data: { token } });
            if (!live) return;
            setWaiting(false);
            setPortal(data);
            return;
          }
          if (gate.status === "pending") {
            setWaiting(true);
            return;
          }
          window.localStorage.removeItem(TOKEN_KEY);
          window.sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setWaiting(false);
          setPortal(null);
          setError(gate.status === "locked" ? "This partner account is locked." : "Application was not approved.");
        })
        .catch(() => {
          if (!live) return;
        });
    };
    check();
    const id = window.setInterval(check, 3000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await partnerLogin({ data: { email, password } });
      window.localStorage.setItem(TOKEN_KEY, result.token);
      window.sessionStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function onApply(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await applyPartner({ data: { name, email, password } });
      window.localStorage.setItem(TOKEN_KEY, result.token);
      window.sessionStorage.setItem(TOKEN_KEY, result.token);
      setWaiting(true);
      setToken(result.token);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that application.");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setPortal(null);
    setWaiting(false);
  }

  if (!ready) {
    return <main className="grid min-h-dvh place-items-center bg-ink text-sm font-bold text-white/70">Loading</main>;
  }

  if (waiting) {
    return (
      <main className="min-h-dvh bg-ink">
        <SignalLoading label="waiting for approval" />
      </main>
    );
  }

  if (!portal) {
    return (
      <main className="admin-desk home-theme flex min-h-dvh items-center justify-center px-4 py-10 text-white">
        <section className="menu-pop relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#111111]/90 text-white backdrop-blur-sm">
          <div className="px-6 pt-8 text-center">
            <Diamond className="mx-auto size-7 fill-red text-red" aria-hidden />
            <h1 className="mt-4 text-3xl font-black tracking-tight">CASINO ROOM</h1>
            <p className="mt-2 text-xs font-extrabold tracking-[0.22em] text-red">PARTNER ACCESS</p>
          </div>
          <div className="mt-8 grid grid-cols-2 text-sm font-extrabold tracking-wide">
            <button
              type="button"
              onClick={() => {
                setMode("sign");
                setError(null);
                setApplied(false);
              }}
              className={"border-b-2 py-3 " + (mode === "sign" ? "border-red text-red" : "border-white/10 text-[#8b95a7]")}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("apply");
                setError(null);
              }}
              className={"border-b-2 py-3 " + (mode === "apply" ? "border-red text-red" : "border-white/10 text-[#8b95a7]")}
            >
              BECOME A PARTNER
            </button>
          </div>
          {mode === "sign" ? (
            <form onSubmit={onSubmit} className="px-6 py-6">
              <Field label="EMAIL" id="partner-email">
                <input
                  id="partner-email"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="PASSWORD" id="partner-password">
                <input
                  id="partner-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={fieldClass}
                />
              </Field>
              {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="mt-5 h-12 w-full rounded-xl bg-red text-sm font-extrabold tracking-[0.16em] text-white disabled:opacity-70"
              >
                {busy ? "SIGNING IN" : "SIGN IN"}
              </button>
              <p className="mt-4 text-center text-sm leading-relaxed text-[#8b95a7]">
                New partners must be approved by an admin before first sign-in.
              </p>
            </form>
          ) : (
            <form onSubmit={onApply} className="px-6 py-6">
              <Field label="FULL NAME" id="partner-name">
                <input
                  id="partner-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="EMAIL" id="partner-apply-email">
                <input
                  id="partner-apply-email"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="PASSWORD" id="partner-apply-password">
                <input
                  id="partner-apply-password"
                  type="password"
                  placeholder="Choose a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="CONFIRM PASSWORD" id="partner-confirm">
                <input
                  id="partner-confirm"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className={fieldClass}
                />
              </Field>
              {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
              {applied ? (
                <p className="mt-3 text-sm text-[#7ddea0]">Application sent. An admin must approve it before you can sign in.</p>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="mt-5 h-12 w-full rounded-xl bg-red text-sm font-extrabold tracking-[0.16em] text-white disabled:opacity-70"
              >
                {busy ? "SENDING" : "APPLY AS PARTNER"}
              </button>
              <p className="mt-4 text-center text-sm leading-relaxed text-[#8b95a7]">
                Your application is reviewed by an admin. You'll be able to sign in once approved.
              </p>
            </form>
          )}
          <div className="flex justify-center pb-6 pt-2">
            <Link to="/" className="auth-back-home">
              <span className="auth-back-home-icon" aria-hidden="true">
                <ArrowLeft size={15} strokeWidth={2.5} />
              </span>
              <span>Back to site</span>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const link =
    typeof window === "undefined" ? "" : `${window.location.origin}/?ref=${portal.code}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="admin-desk home-theme desk-shell text-white">
      <aside className="admin-side border-r border-white/10 bg-transparent px-4 py-6">
        <div className="flex items-center gap-2 px-2">
          <Diamond className="size-4 fill-red text-red" aria-hidden />
          <span className="text-lg font-black leading-tight">
            Aviator
            <br />
            Hack
          </span>
          <span className="rounded-full border border-red px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-red">
            PARTNER
          </span>
        </div>
        <nav className="mt-8 space-y-1">
          <DeskButton active={desk === "overview"} onClick={() => setDesk("overview")} icon={<LayoutGrid className="size-4" />}>
            OVERVIEW
          </DeskButton>
          <DeskButton active={desk === "referrals"} onClick={() => setDesk("referrals")} icon={<Users className="size-4" />}>
            REFERRALS
          </DeskButton>
          <DeskButton active={desk === "payouts"} onClick={() => setDesk("payouts")} icon={<Wallet className="size-4" />}>
            PAYOUTS
          </DeskButton>
        </nav>
        <button type="button" onClick={signOut} className="mt-auto px-3 py-3 text-left text-xs font-extrabold tracking-wide text-[#8b95a7]">
          SIGN OUT
        </button>
      </aside>
      <section className="min-w-0 flex-1">
        <header className="admin-mobile-nav flex gap-2 overflow-x-auto border-b border-white/10 bg-transparent px-4 py-3">
          <button
            type="button"
            onClick={() => setDesk("overview")}
            className={"rounded-xl px-3 py-2 text-xs font-extrabold tracking-wide " + (desk === "overview" ? "bg-red text-white" : "text-[#9aa3b2]")}
          >
            OVERVIEW
          </button>
          <button
            type="button"
            onClick={() => setDesk("referrals")}
            className={"rounded-xl px-3 py-2 text-xs font-extrabold tracking-wide " + (desk === "referrals" ? "bg-red text-white" : "text-[#9aa3b2]")}
          >
            REFERRALS
          </button>
          <button type="button" onClick={() => setDesk("payouts")} className={"rounded-xl px-3 py-2 text-xs font-extrabold tracking-wide " + (desk === "payouts" ? "bg-red text-white" : "text-[#9aa3b2]")}>
            PAYOUTS
          </button>
          <button type="button" onClick={signOut} className="ml-auto text-xs font-bold text-[#8b95a7]">
            Sign out
          </button>
        </header>
        <div className="admin-content">
          {desk === "overview" ? (
            <>
              <Overview portal={portal} link={link} copied={copied} onCopy={() => void copyLink()} />
              <button type="button" onClick={() => setDesk("payouts")} className="mt-5 min-h-12 w-full rounded-xl bg-red px-4 py-3 text-sm font-extrabold text-white">REQUEST YESTERDAY'S PAYOUT</button>
            </>
          ) : desk === "payouts" && token ? (
            <PartnerPayoutDesk token={token} />
          ) : (
            <Referrals rows={portal.referrals} />
          )}
        </div>
      </section>
    </main>
  );
}

function Overview({
  portal,
  link,
  copied,
  onCopy,
}: {
  portal: PartnerPortal;
  link: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <>
      <p className="text-xs font-extrabold tracking-[0.18em] text-red">PARTNER PORTAL</p>
      <h1 className="mt-3 font-black tracking-tight">
        Welcome, <span className="text-red">{portal.name}</span>
      </h1>
      <section className="mt-6 rounded-3xl border border-white/10 bg-[#111111] px-5 py-5">
        <p className="text-xs font-bold tracking-[0.16em] text-[#9aa3b2]">YOUR REFERRAL LINK · CODE {portal.code}</p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <p className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-ink px-3 py-3 text-sm text-white">{link}</p>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-red px-4 text-xs font-extrabold tracking-wide text-white"
          >
            <Copy className="size-4" aria-hidden />
            {copied ? "COPIED" : "COPY LINK"}
          </button>
        </div>
      </section>
      <div className="mt-4">
        <Stat
          label="REFERRED MEMBERS"
          value={String(portal.members)}
          note={`${portal.active} currently active`}
          icon={<Users className="size-4" />}
        />
      </div>
      <div className="stat-grid cols-3 mt-4">
        <Stat
          label="TODAY'S REVENUE"
          value={`GHS ${portal.todayRevenue.toLocaleString("en-GH")}`}
          note={`${portal.days.find((day) => day.today)?.label ?? "today"} · ${portal.todaySales} sales · resets at midnight`}
          icon={<CalendarDays className="size-4" />}
        />
        <Stat
          label="REVENUE BROUGHT IN"
          value={`GHS ${portal.revenue.toLocaleString("en-GH")}`}
          note="Confirmed Ghana payments. Does not reset."
          icon={<CircleDollarSign className="size-4" />}
        />
        <Stat
          label={`YOUR EARNINGS · ${portal.commission}%`}
          value={`GHS ${portal.earnings.toLocaleString("en-GH")}`}
          note={`${portal.commission}% deducted from confirmed Ghana payments`}
          gold
          icon={<Star className="size-4" />}
        />
      </div>
      <DayList title="Daily Revenue" unit="GHS" days={portal.days} country="Ghana" />
      <div className="stat-grid cols-3 mt-4">
        <Stat
          label="TODAY'S REVENUE"
          value={`₦${portal.nigeriaTodayRevenue.toLocaleString("en-NG")}`}
          note={`${portal.nigeriaDays.find((day) => day.today)?.label ?? "today"} · ${portal.nigeriaTodaySales} sales · resets at midnight`}
          icon={<CalendarDays className="size-4" />}
        />
        <Stat
          label="REVENUE BROUGHT IN"
          value={`₦${portal.nigeriaRevenue.toLocaleString("en-NG")}`}
          note="Confirmed Nigeria payments. Does not reset."
          icon={<CircleDollarSign className="size-4" />}
        />
        <Stat
          label={`YOUR EARNINGS · ${portal.commission}%`}
          value={`₦${portal.nigeriaEarnings.toLocaleString("en-NG")}`}
          note={`${portal.commission}% deducted from confirmed Nigeria payments`}
          gold
          icon={<Star className="size-4" />}
        />
      </div>
      <DayList title="Daily Revenue" unit="₦" days={portal.nigeriaDays} country="Nigeria" />
    </>
  );
}

function DayList({
  title,
  unit,
  days,
  country = "Ghana",
}: {
  title: string;
  unit: "GHS" | "₦";
  country?: string;
  days: PartnerPortal["days"];
}) {
  const money = (amount: number) =>
    unit === "GHS" ? `GHS ${amount.toLocaleString("en-GH")}` : `₦${amount.toLocaleString("en-NG")}`;
  return (
    <section className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#111111]">
      <div className="flex items-center gap-3 px-5 py-5">
        <h2 className="text-lg font-black">{title}</h2>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-[#9aa3b2]">{country}</span>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-[#9aa3b2]">
          {days.find((day) => day.today)?.label ?? "today"}
        </span>
      </div>
      <ul className="overflow-x-auto">
        {days.map((day) => (
          <li key={country + day.label} className="partner-week week-row desk-row whitespace-nowrap text-sm">
            <span className={day.today ? "font-extrabold text-red" : "font-bold text-[#9aa3b2]"}>{day.label}</span>
            <span className="text-[#8b95a7]">
              {money(day.revenue)} · {money(day.cut)} net earnings
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Referrals({ rows }: { rows: PartnerPortal["referrals"] }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111111]">
      <div className="flex items-center gap-2 px-5 py-5">
        <h1 className="text-2xl font-black">Your Referrals</h1>
        <span className="grid min-w-6 place-items-center rounded-full border border-white/15 px-2 text-xs font-bold text-[#9aa3b2]">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-[#333] px-4 py-10 text-center text-sm text-[#8b95a7]">
          No referrals yet. Share your link to get started.
        </p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-t border-[#333] text-left text-[11px] font-bold tracking-[0.14em] text-[#aaa]">
                <th className="px-5 py-3 font-bold">PLAYER NAME</th>
                <th className="px-5 py-3 font-bold">STATUS</th>
                <th className="px-5 py-3 font-bold">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name + row.joined} className="border-t border-[#333]">
                  <td className="px-5 py-4">
                    <p className="font-extrabold">{row.name}</p>
                    <p className="text-xs text-[#aaa]">
                      {row.joined
                        ? new Date(row.joined).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={row.status === "paid" ? "pill-active" : "pill-unpaid"}>
                      {row.status === "paid" ? "ACTIVE" : "UNPAID"}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-bold whitespace-nowrap">
                    {row.country === "Nigeria" || (row.spendNgn > 0 && row.spendGhs === 0)
                      ? `₦${row.spendNgn.toLocaleString("en-NG")}`
                      : `GHS ${row.spendGhs.toLocaleString("en-GH")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DeskButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-extrabold tracking-wide " +
        (active ? "bg-red text-white" : "text-[#6b7280]")
      }
    >
      {icon}
      {children}
    </button>
  );
}

const fieldClass = "mt-2 h-12 w-full rounded-xl border border-line bg-ink px-3 text-white outline-none placeholder:text-white/40";

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <label className="mt-4 block text-xs font-bold tracking-[0.16em] text-[#9aa3b2]" htmlFor={id}>
      {label}
      {children}
    </label>
  );
}

function Stat({
  label,
  value,
  note,
  icon,
  gold = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  gold?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-[#111111] px-5 py-5 text-white">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold tracking-[0.16em] text-white/50">{label}</p>
        <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-white">{icon}</span>
      </div>
      <p className={"mt-4 text-4xl font-black tracking-tight " + (gold ? "text-[#f0c14d]" : "")}>{value}</p>
      <div className="my-4 h-px bg-white/10" />
      <p className="text-sm text-white/60">{note}</p>
    </article>
  );
}
