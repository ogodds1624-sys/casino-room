import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PREDICTOR_URL, clearSession, readSession, sessionLeft } from "@/lib/desk-session";
import { confirmedDeskLogin, getSportyLink } from "@/lib/admin-snapshot";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { openTask } from "@/lib/task-order";

export const Route = createFileRoute("/session")({
  component: SessionPage,
});

function SessionPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? "";
  const devFallback = user?.isDevFallback === true;
  const [left, setLeft] = useState<number | null>(null);
  const [mins, setMins] = useState(0);
  const [desk, setDesk] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    let timer = 0;
    const look = () => {
      void confirmedDeskLogin()
        .then((row) => {
          if (cancel) return;
          if (row.pass) {
            setDesk(
              `${PREDICTOR_URL}?pass=${encodeURIComponent(row.pass)}&login=${encodeURIComponent(row.login)}`,
            );
            return;
          }
          setDesk((current) => current ?? PREDICTOR_URL);
          timer = window.setTimeout(look, 4000);
        })
        .catch(() => {
          if (cancel) return;
          setDesk((current) => current ?? PREDICTOR_URL);
          timer = window.setTimeout(look, 4000);
        });
    };
    look();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isPending) return;
    const tick = () => {
      const session = readSession();
      const ms = sessionLeft();
      if (!session || ms <= 0) {
        clearSession();
        if (!userId || devFallback) {
          void navigate({ to: "/" });
          return;
        }
        void getSportyLink().then((link) => {
          if (!link.signedIn) {
            void navigate({ to: "/" });
            return;
          }
          void openTask(navigate, link);
        });
        return;
      }
      setMins(session.mins);
      setLeft(ms);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [navigate, isPending, userId, devFallback]);

  if (left == null) return null;
  const total = Math.ceil(left / 1000);
  const clock = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

  return (
    <main className="flex h-dvh flex-col bg-ink text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-xs font-extrabold tracking-[0.16em]">SESSION</p>
        <p className="text-sm text-white/60">{mins} mins</p>
        <p className={"font-mono text-xl font-black " + (total <= 30 ? "text-red" : "text-[#3dde6a]")}>{clock}</p>
      </div>
      {desk ? (
        <iframe title="Aviator Predictor" src={desk} className="min-h-0 w-full flex-1 border-0 bg-white" />
      ) : (
        <div className="min-h-0 w-full flex-1 bg-white" />
      )}
    </main>
  );
}
