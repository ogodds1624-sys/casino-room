import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Plane, Sparkles } from "lucide-react";
import { AviatorBoard } from "@/components/aviator-board";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getApprovedTestimonies, getSportyLink } from "@/lib/admin-snapshot";
import { clearPending } from "@/lib/pending-registration";
import { openTask } from "@/lib/task-order";
import { useLiveStorefront } from "@/lib/storefront-live";
import { useBlocked } from "@/lib/blocked-users";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => {
    const ref = typeof search.ref === "string" ? search.ref.trim() : "";
    return ref ? { ref } : {};
  },
  component: Home,
});

const CALLS = [
  { n: 4821, label: "Safer cash-out window", x: "2.14x" },
  { n: 4820, label: "Hold — high volatility", x: "1.42x" },
  { n: 4819, label: "Exit flagged", x: "3.08x" },
  { n: 4822, label: "Watch the climb", x: "1.87x" },
  { n: 4823, label: "Safer cash-out window", x: "2.55x" },
  { n: 4824, label: "Exit flagged", x: "4.62x" },
];

function Home() {
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const store = useLiveStorefront();
  const signedIn = !isPending && Boolean(user) && !user?.isDevFallback;
  const blocked = useBlocked();
  const [tick, setTick] = useState(0);
  const [testimonies, setTestimonies] = useState<
    { name: string; place: string; text: string; stars: number }[]
  >([]);
  const [testimoniesLoading, setTestimoniesLoading] = useState(true);
  const [testimoniesError, setTestimoniesError] = useState(false);

  async function openAccount() {
    if (isPending || blocked) return;
    if (!signedIn) {
      await navigate({ to: "/register" });
      return;
    }
    await openTask(navigate, await getSportyLink());
  }

  useEffect(() => {
    clearPending();
  }, []);

  useEffect(() => {
    if (ref) window.localStorage.setItem("aviator-ref", ref.slice(0, 80));
  }, [ref]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 3500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let current = true;
    const loadTestimonies = () => {
      void getApprovedTestimonies()
        .then((rows) => {
          if (!current) return;
          setTestimonies(rows);
          setTestimoniesError(false);
          setTestimoniesLoading(false);
        })
        .catch(() => {
          if (!current) return;
          setTestimoniesError(true);
          setTestimoniesLoading(false);
        });
    };
    loadTestimonies();
    const refreshId = window.setInterval(loadTestimonies, 30000);
    return () => {
      current = false;
      window.clearInterval(refreshId);
    };
  }, []);

  const rows = [0, 1, 2].map((offset) => CALLS[(tick + offset) % CALLS.length]);

  return (
    <div className="home-theme min-h-dvh text-white">
      <SiteHeader />
      {blocked ? (
        <p role="alert" className="bg-red px-4 py-3 text-center text-sm font-bold text-white">
          This account has been blocked. You can sign in with another account or sign out.
        </p>
      ) : null}
      <div className="ticker-band">
        {testimoniesError ? (
          <p className="text-center text-sm font-semibold text-white/75">Testimonies are temporarily unavailable.</p>
        ) : testimonies.length ? (
          <a
            href="#send-testimony"
            className="testimony-link block text-inherit no-underline"
            aria-label="Send your testimony"
          >
            <div className="testimony-marquee" aria-label="Approved testimonies">
              <div className="testimony-marquee-track">
                {[0, 1].map((copy) => (
                  <div className="testimony-marquee-group" key={copy} aria-hidden={copy === 1}>
                    {testimonies.map((item, index) => (
                      <article className="home-testimony" key={`${copy}-${item.name}-${index}`}>
                        <span className="home-testimony-avatar" aria-hidden="true">{item.name.trim().charAt(0).toUpperCase()}</span>
                        <div className="home-testimony-body">
                          <div className="home-testimony-head">
                            <span className="home-testimony-name">{item.name}</span>
                            {item.place ? <span className="home-testimony-place">{item.place}</span> : null}
                            <span className="sr-only">{item.stars} out of 5 stars</span>
                            <span aria-hidden="true" className="home-testimony-stars">{"★".repeat(item.stars)}</span>
                          </div>
                          <p className="home-testimony-text">&ldquo;{item.text}&rdquo;</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </a>
        ) : (
          <p className="text-center text-sm font-semibold text-white/75">
            {testimoniesLoading ? "Loading approved testimonies…" : "Approved testimonies will appear here."}
          </p>
        )}
      </div>

      <div className="hero-layout hero-glow">
        <div className="hero-copy">
        <h1 className="casino-title text-[2.35rem] leading-tight font-black tracking-tight">
          <span>CASINO</span> <span className="casino-title-accent">ROOM</span>
        </h1>
        <p className="hero-description-float mt-5 rounded-r-xl border-l-2 border-red bg-black/35 px-4 py-3 text-left text-base leading-7 text-white/85 shadow-[0_8px_30px_rgba(0,0,0,0.18)] sm:text-lg sm:leading-8">
          Our system tracks live Aviator signals, decodes multiplier patterns, and delivers precise
          cash-out opportunities before the round finishes
        </p>
        {store && store.rates.length > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {store.rates.map((rate) => `${rate.country} ${rate.unit}${rate.perGhs} per GHS`).join(" · ")}
          </p>
        ) : null}
        <div className="hero-actions">
          <button
            type="button"
            onClick={() => void openAccount()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red px-5 text-sm font-extrabold tracking-wide text-white"
          >
            GET STARTED
            <Sparkles className="size-4" aria-hidden />
          </button>
        </div>
        </div>

      </div>

      <main id="desk" className="page-wrap">
        <div className="desk-layout">
        <article className="predictor-card overflow-hidden rounded-3xl">
          <div className="relative aspect-[16/10] overflow-hidden bg-[#12081f]">
            <AviatorBoard />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-red/50 bg-black/60 px-3 py-1.5 text-xs font-extrabold tracking-wide text-white">
              <span className="live-dot live-board-dot size-2.5 rounded-full bg-red" />
              LIVE BOARD
            </div>
          </div>
          <div className="predictor-content">
            <div className="predictor-heading-row">
              <div>
                <h3 className="predictor-title">
                  Aviator <span>Predictor</span>
                </h3>
              </div>
              <span className="predictor-plane-mark" aria-hidden="true">
                <Plane className="size-5" />
              </span>
            </div>
            <p className="predictor-description">
              Open the live desk, read the predicted coefficient, and take the cash-out window
              before the plane flies.
            </p>
            <button
              type="button"
              onClick={() => void openAccount()}
              className="predictor-cta buy-pulse mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red text-base font-extrabold text-white"
            >
              <span>Start Now</span>
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </article>

        <section className="relative mt-6 overflow-hidden rounded-3xl border border-red/20 bg-gradient-to-br from-[#1a0b0b] via-[#100707] to-black p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:p-5">
          <div className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-red/10 blur-3xl" />
          <div className="relative mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.22em] text-red uppercase">Live signals</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">Prediction feed</h2>
              <p className="mt-1 text-xs text-white/50">Recent round cash-out windows</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-emerald-300 uppercase">
              <span className="feed-live-dot relative size-2 rounded-full bg-emerald-300" aria-hidden="true" />
              Live
            </span>
          </div>
          <ul className="relative space-y-2.5">
            {rows.map((row, index) => (
              <li
                key={row.n}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 transition-colors hover:border-red/25 hover:bg-white/[0.06] sm:px-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-red/20 bg-red/10 text-xs font-black tabular-nums text-red">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                    <Plane className="size-3.5 shrink-0 text-gold" aria-hidden />
                    <span className="truncate">Round {row.n}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-white/50">{row.label}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[9px] font-bold tracking-[0.16em] text-white/35 uppercase">Window</span>
                  <span className="mt-0.5 block text-lg font-black tabular-nums text-gold">{row.x}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
