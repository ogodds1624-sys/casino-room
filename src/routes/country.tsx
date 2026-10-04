import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SignalLoading } from "@/components/signal-loading";
import { getSportyLink, savePlayerCountry } from "@/lib/admin-snapshot";
import { readPending, savePending } from "@/lib/pending-registration";
import { openTask } from "@/lib/task-order";

export const Route = createFileRoute("/country")({
  component: CountryPage,
});

function CountryPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stayForContinue = useRef(false);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const link = await getSportyLink();
      if (stop || stayForContinue.current) return;
      if (link.signedIn && !link.country && !link.linked) {
        setReady(true);
        return;
      }
      await openTask(navigate, link);
    })();
    return () => {
      stop = true;
    };
  }, [navigate]);

  async function chooseCountry(country: "Ghana" | "Nigeria") {
    if (saving) return;
    stayForContinue.current = true;
    setError(null);
    setSaving(true);
    try {
      await savePlayerCountry({ data: { country } });
      const link = await getSportyLink();
      if (link.country !== country) {
        stayForContinue.current = false;
        setError("Could not confirm that country.");
        return;
      }
      const pending = readPending();
      if (pending) savePending({ ...pending, country, completionStatus: false });
      window.localStorage.setItem("aviator-country", country);
      await navigate({ to: "/connect" });
    } catch (err) {
      stayForContinue.current = false;
      setError(err instanceof Error && err.message ? err.message : "Could not save that country.");
    } finally {
      setSaving(false);
    }
  }

  function backToRegistration() {
    window.sessionStorage.setItem("aviator-stay-register", "1");
    void navigate({ to: "/register" });
  }

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink">
        <SignalLoading />
      </main>
    );
  }

  return (
    <main className="home-theme relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8 text-white">
      <section className="menu-pop relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-black/55 px-5 py-6 text-white">
          <button
            type="button"
            onClick={backToRegistration}
            className="auth-back-home mb-4"
          >
            <span className="auth-back-home-icon" aria-hidden="true">
              <ArrowLeft size={15} strokeWidth={2.5} />
            </span>
            <span>Back</span>
          </button>
          <h1 className="text-center text-2xl font-black tracking-tight">Choose your country</h1>
          {error ? (
            <p className="mt-3 text-center text-sm font-medium text-red" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => void chooseCountry("Ghana")}
              disabled={saving}
              className="buy-pulse flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-red text-base font-extrabold tracking-wide text-white disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-3">
                <svg viewBox="0 0 24 16" className="h-6 w-9 rounded-sm" aria-hidden>
                  <rect width="24" height="5.34" fill="#ce1126" />
                  <rect y="5.33" width="24" height="5.34" fill="#fcd116" />
                  <rect y="10.66" width="24" height="5.34" fill="#006b3f" />
                  <polygon
                    points="12,6.2 12.7,8.2 14.8,8.2 13.1,9.4 13.8,11.4 12,10.2 10.2,11.4 10.9,9.4 9.2,8.2 11.3,8.2"
                    fill="#000"
                  />
                </svg>
                Ghana
              </span>
            </button>
            <button
              type="button"
              onClick={() => void chooseCountry("Nigeria")}
              disabled={saving}
              style={{ animationDelay: "0.2s" }}
              className="buy-pulse flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-red text-base font-extrabold tracking-wide text-white disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-3">
                <svg viewBox="0 0 24 16" className="h-6 w-9 rounded-sm" aria-hidden>
                  <rect width="8" height="16" fill="#008751" />
                  <rect x="8" width="8" height="16" fill="#fff" />
                  <rect x="16" width="8" height="16" fill="#008751" />
                </svg>
                Nigeria
              </span>
            </button>
          </div>
        </section>
    </main>
  );
}
