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
                  <span className={"package-card-icon" + (pack.price === 350 ? " package-card-icon-gold" : pack.price === 800 ? " package-card-icon-gold package-card-icon-platinum" : pack.price === 1700 ? " package-card-icon-gold package-card-icon-diamond" : "")}>
                    {pack.price === 350 ? (
                      <svg className="package-gold-bar" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="coin-face" x1="8" y1="6" x2="40" y2="30" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FFF3B0" />
                            <stop offset=".5" stopColor="#F6C94E" />
                            <stop offset="1" stopColor="#C9801A" />
                          </linearGradient>
                          <linearGradient id="coin-edge" x1="0" y1="0" x2="0" y2="1">
                            <stop stopColor="#D9961F" />
                            <stop offset="1" stopColor="#8A4A0B" />
                          </linearGradient>
                        </defs>
                        <path d="M8 34v-4c0-2.6 7.2-4.5 16-4.5s16 1.9 16 4.5v4c0 2.6-7.2 4.5-16 4.5S8 36.600 8 34Z" fill="url(#coin-edge)" />
                        <ellipse cx="24" cy="30" rx="16" ry="4.500" fill="url(#coin-face)" stroke="#FFE99A" strokeWidth=".8" />
                        <path d="M8 26v-4c0-2.6 7.2-4.5 16-4.5s16 1.9 16 4.5v4c0 2.6-7.2 4.5-16 4.5S8 28.600 8 26Z" fill="url(#coin-edge)" />
                        <ellipse cx="24" cy="22" rx="16" ry="4.500" fill="url(#coin-face)" stroke="#FFE99A" strokeWidth=".8" />
                        <path d="M8 18v-4c0-2.6 7.2-4.5 16-4.5s16 1.9 16 4.5v4c0 2.6-7.2 4.5-16 4.5S8 20.600 8 18Z" fill="url(#coin-edge)" />
                        <ellipse cx="24" cy="14" rx="16" ry="4.500" fill="url(#coin-face)" stroke="#FFE99A" strokeWidth=".8" />
                        <ellipse cx="24" cy="14" rx="9" ry="2.200" stroke="#B8710F" strokeWidth=".9" opacity=".7" />
                        <path d="M14 12.500c3-1.500 9-1.800 13-.600" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".75" />
                        <path d="M38 7l1.200 2.800L42 11l-2.800 1.200L38 15l-1.200-2.800L34 11l2.800-1.200L38 7Z" fill="#FFF3B0" />
                      </svg>
                    ) : pack.price === 800 ? (
                      <svg className="package-gold-bar" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="plat-face" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FFFFFF" />
                            <stop offset=".5" stopColor="#C9D6E8" />
                            <stop offset="1" stopColor="#7F8FA8" />
                          </linearGradient>
                          <linearGradient id="plat-rim" x1="0" y1="0" x2="1" y2="1">
                            <stop stopColor="#EAF2FF" />
                            <stop offset="1" stopColor="#5E6E88" />
                          </linearGradient>
                        </defs>
                        <circle cx="24" cy="25" r="18" fill="#4B5A73" />
                        <circle cx="24" cy="23" r="18" fill="url(#plat-rim)" />
                        <circle cx="24" cy="23" r="14.500" fill="url(#plat-face)" stroke="#FFFFFF" strokeWidth=".8" />
                        <circle cx="24" cy="23" r="11.500" stroke="#7F8FA8" strokeWidth=".8" opacity=".7" />
                        <path d="m24 13.500 2.900 6 6.600.9-4.800 4.600 1.200 6.500L24 28.300l-5.900 3.200 1.200-6.500-4.800-4.600 6.600-.9 2.900-6Z" fill="#E8F1FF" stroke="#8A9AB4" strokeWidth=".9" strokeLinejoin="round" />
                        <path d="M13 17c2-4 6-6.500 10-6.800" stroke="#fff" strokeWidth="1.400" strokeLinecap="round" opacity=".85" />
                        <path d="M40 6l1 2.400L43.400 9.400 41 10.400 40 12.800l-1-2.400-2.400-1L39 8.400 40 6Z" fill="#fff" />
                      </svg>
                    ) : pack.price === 1700 ? (
                      <svg className="package-gold-bar" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="dia-top" x1="8" y1="8" x2="40" y2="20" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#E9FBFF" />
                            <stop offset="1" stopColor="#7FD8F5" />
                          </linearGradient>
                          <linearGradient id="dia-body" x1="24" y1="18" x2="24" y2="44" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#4CC3F0" />
                            <stop offset="1" stopColor="#1E6FC9" />
                          </linearGradient>
                        </defs>
                        <path d="M14 8h20l8 10-18 24L6 18l8-10Z" fill="url(#dia-body)" stroke="#D9F6FF" strokeWidth="1" strokeLinejoin="round" />
                        <path d="M14 8h20l8 10H6l8-10Z" fill="url(#dia-top)" stroke="#D9F6FF" strokeWidth="1" strokeLinejoin="round" />
                        <path d="m18 18 6-10 6 10-6 24-6-24Z" fill="#fff" opacity=".28" />
                        <path d="M6 18h36M18 18l6 24 6-24M14 8l4 10M34 8l-4 10" stroke="#EFFCFF" strokeWidth=".8" strokeLinejoin="round" opacity=".75" />
                        <path d="M40 4l1 2.400L43.400 7.400 41 8.400 40 10.800l-1-2.400-2.400-1L39 6.400 40 4Z" fill="#fff" />
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
                    <strong>Unlock sessions</strong>
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
