import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Clock3, Flame, Gem, Zap } from "lucide-react";
import { SignalLoading } from "@/components/signal-loading";
import { getSportyLink } from "@/lib/admin-snapshot";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLiveStorefront } from "@/lib/storefront-live";
import { sessionLeft } from "@/lib/desk-session";
import { openTask } from "@/lib/task-order";

export const Route = createFileRoute("/packages")({
  validateSearch: (search: Record<string, unknown>): { rejected?: 1; stay?: 1 } => {
    const next: { rejected?: 1; stay?: 1 } = {};
    if (search.rejected === 1 || search.rejected === "1") next.rejected = 1;
    if (search.stay === 1 || search.stay === "1") next.stay = 1;
    return next;
  },
  component: PackagesPage,
});

const PACKAGES = [
  {
    price: 350,
    detail: "3 mins per session",
    icon: Zap,
  },
  {
    price: 800,
    detail: "10 mins per session",
    icon: Flame,
  },
  {
    price: 1700,
    detail: "20 mins per session",
    icon: Gem,
  },
];

function PackagesPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? "";
  const devFallback = user?.isDevFallback === true;
  const { rejected, stay } = Route.useSearch();
  const [ready, setReady] = useState(false);
  const store = useLiveStorefront();
  const [alertOn, setAlertOn] = useState(Boolean(rejected));

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
      if (link.country === "Nigeria") {
        void navigate({ to: "/nigeria-pay", viewTransition: false });
        return;
      }
      setReady(true);
    });
    return () => {
      stop = true;
    };
  }, [isPending, userId, devFallback, navigate]);

  useEffect(() => {
    if (!rejected) return;
    const id = window.setTimeout(() => setAlertOn(false), 7000);
    return () => window.clearTimeout(id);
  }, [rejected]);

  useEffect(() => {
    if (stay) return;
    if (sessionLeft() > 0) void navigate({ to: "/session", viewTransition: false });
  }, [navigate, stay]);

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink">
        <SignalLoading />
      </main>
    );
  }

  return (
    <main className="home-theme relative min-h-dvh overflow-hidden px-4 py-10 text-white">
      <div className="relative z-10 mx-auto w-full max-w-md">
        {alertOn ? (
          <div className="reject-banner mb-5 rounded-2xl border border-red bg-black/75 px-4 py-4 text-center" role="alert">
            <p className="text-sm font-extrabold tracking-wide text-red">PAYMENT REJECTED</p>
            <p className="mt-1 text-base font-bold text-white">Your payment was rejected. Choose a package and try again.</p>
          </div>
        ) : null}
        <Link
          to="/"
          className="auth-back-home mb-4"
        >
          <span className="auth-back-home-icon" aria-hidden="true">
            <ArrowLeft size={15} strokeWidth={2.5} />
          </span>
          <span>Back home</span>
        </Link>
        <p className="package-kicker">Casino Room <span aria-hidden="true">/</span> Session Menu</p>
        <h1 className="package-title">
          Choose Your <span>Package</span>
        </h1>
        <p className="package-subtitle">
          Buy session time · Use anytime
        </p>
        {store && store.rates.length > 0 ? (
          <p className="mt-3 text-center text-xs leading-relaxed text-white/70">
            Estimate only. Checkout still charges GHS.{" "}
            {store.rates.map((rate) => `${rate.country} ${rate.unit}${rate.perGhs} per GHS`).join(" · ")}
          </p>
        ) : null}
        <div className="mt-6 space-y-4">
          {PACKAGES.map((pack, index) => {
            const Icon = pack.icon;
            return (
              <article
                key={pack.price}
                className="package-card"
              >
                <div className="package-card-top">
                  <div className="package-price-block">
                    <h2 className="package-price">
                      <span>GHS</span> {pack.price.toLocaleString("en-GH")}
                    </h2>
                  </div>
                  <span className="package-card-icon">
                    {pack.price === 350 ? (
                      <svg className="package-gold-bar" viewBox="0 0 48 40" fill="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="gold-bar-top" x1="9" y1="7" x2="39" y2="24" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FFF0A8" />
                            <stop offset=".48" stopColor="#F5C84B" />
                            <stop offset="1" stopColor="#C67A18" />
                          </linearGradient>
                          <linearGradient id="gold-bar-front" x1="12" y1="18" x2="35" y2="35" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#F6CC55" />
                            <stop offset="1" stopColor="#B87512" />
                          </linearGradient>
                          <linearGradient id="gold-bar-side" x1="34" y1="19" x2="43" y2="31" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#E9AE34" />
                            <stop offset="1" stopColor="#8E4B0C" />
                          </linearGradient>
                        </defs>
                        <path d="m10 10 7-5h17l6 5-5 17-8 7H14l-5-7 1-17Z" fill="url(#gold-bar-top)" stroke="#FFE99A" strokeWidth="1.2" strokeLinejoin="round" />
                        <path d="m10 10 24 0 6 0-5 17-8 7V17L10 10Z" fill="url(#gold-bar-top)" />
                        <path d="m10 10 17 7v17l-13-1-5-6 1-17Z" fill="url(#gold-bar-front)" stroke="#D79827" strokeWidth=".8" strokeLinejoin="round" />
                        <path d="m27 17 13-7-5 17-8 7V17Z" fill="url(#gold-bar-side)" stroke="#C48720" strokeWidth=".8" strokeLinejoin="round" />
                        <path d="m14 12 13 5 10-5" stroke="#FFF1B3" strokeWidth="1" strokeLinecap="round" opacity=".8" />
                        <path d="m16 25 7 2m-6-5 6 2" stroke="#FFE48A" strokeWidth=".8" strokeLinecap="round" opacity=".72" />
                        <path d="m29 20 6-3m-6 7 5-2" stroke="#FFD76B" strokeWidth=".8" strokeLinecap="round" opacity=".65" />
                      </svg>
                    ) : (
                      <Icon aria-hidden />
                    )}
                  </span>
                </div>
                <div className="package-card-meta">
                  <p className="package-duration">
                    <Clock3 aria-hidden />
                    {pack.detail}
                  </p>
                  <span className="package-availability">
                    <span aria-hidden="true" />
                    Available
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({ to: "/pay", search: { amount: pack.price }, viewTransition: false })
                  }
                  style={{ animationDelay: `${index * 0.2}s` }}
                  className="buy-pulse package-buy-button mt-4"
                >
                  <span className="package-buy-copy">
                    <span>Unlock your session</span>
                    <strong>PAY GHS {pack.price.toLocaleString("en-GH")}</strong>
                  </span>
                  <span className="package-buy-arrow" aria-hidden="true">
                    <ArrowRight />
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
