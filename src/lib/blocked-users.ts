import { useEffect, useSyncExternalStore } from "react";
import { createServerFn } from "@tanstack/react-start";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/** Whether the signed-in account has been blocked by an admin. */
export const getBlockState = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const user = await getSessionUser(undefined, { includeBlocked: true });
  return { signedIn: Boolean(user), blocked: user?.blocked === true };
});

let blockedUserId: string | null = null;
const listeners = new Set<() => void>();

function setBlockedUserId(next: string | null) {
  if (blockedUserId === next) return;
  blockedUserId = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the current signed-in user is blocked. Read-only; `useBlockWatcher` keeps it fresh. */
export function useBlocked() {
  const { user } = useCurrentUserState();
  const userId = user && !user.isDevFallback ? user.id : "";
  const current = useSyncExternalStore(subscribe, () => blockedUserId, () => null);
  return Boolean(userId) && current === userId;
}

/** Mount once near the root: checks the block state on load, on navigation and every 15 seconds. */
export function useBlockWatcher(path: string) {
  const { user, isPending } = useCurrentUserState();
  const userId = user && !user.isDevFallback ? user.id : "";

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      setBlockedUserId(null);
      return;
    }
    let stop = false;
    const check = () => {
      void getBlockState()
        .then((result) => {
          if (!stop) setBlockedUserId(result.blocked ? userId : null);
        })
        .catch(() => {
          // A failed check keeps the last known state.
        });
    };
    check();
    const timer = window.setInterval(check, 15000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [isPending, userId, path]);
}
