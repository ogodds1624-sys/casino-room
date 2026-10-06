import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignalLoading } from "@/components/signal-loading";
import { getPaymentStatus } from "@/lib/admin-snapshot";
import { clearPendingPayment, confirmPendingPayment, readPendingPayment } from "@/lib/desk-session";

// Pages that run their own waiting screen.
const OWN_SCREEN = ["/pay", "/nigeria-pay", "/admin", "/session"];

export function PendingPaymentWatcher() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [state, setState] = useState<"none" | "pending" | "confirmed">("none");
  const skip = OWN_SCREEN.includes(path);

  useEffect(() => {
    if (skip) {
      setState("none");
      return;
    }
    let stop = false;
    let timer: number | undefined;
    let poll: number | undefined;

    function finish(rejected: boolean) {
      clearPendingPayment();
      setState("none");
      if (rejected) void navigate({ to: "/packages", search: { rejected: 1 }, viewTransition: false });
      else void navigate({ to: "/session" });
    }

    function check() {
      const saved = readPendingPayment();
      if (!saved) {
        if (!stop) setState("none");
        return;
      }
      void getPaymentStatus({ data: { id: saved.id } })
        .then((row) => {
          if (stop) return;
          if (row.status === "rejected") {
            window.clearInterval(poll);
            finish(true);
          } else if (row.status === "confirmed") {
            window.clearInterval(poll);
            setState("confirmed");
            const wait = confirmPendingPayment(saved.id, saved.amount);
            timer = window.setTimeout(() => finish(false), wait);
          } else {
            setState("pending");
          }
        })
        .catch(() => {
          if (!stop && readPendingPayment()) setState("pending");
        });
    }

    check();
    poll = window.setInterval(check, 3000);
    return () => {
      stop = true;
      window.clearInterval(poll);
      window.clearTimeout(timer);
    };
  }, [skip, navigate]);

  if (state === "none") return null;
  return (
    <SignalLoading
      label={state === "confirmed" ? "your network is connecting to the hack server" : "waiting for confirmation"}
    />
  );
}
