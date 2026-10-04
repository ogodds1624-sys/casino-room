import { memo, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AviatorBrandMark } from "@/components/aviator-brand-mark";
import { UserButton } from "@/lib/auth/gates";
import { getSportyLink } from "@/lib/admin-snapshot";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const SiteHeader = memo(function SiteHeader() {
  const { user, isPending } = useCurrentUserState();
  const [linkState, setLinkState] = useState<{ id: string; linked: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const userId = user && !user.isDevFallback ? user.id : "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let stop = false;
    void getSportyLink()
      .then((link) => {
        if (!stop) setLinkState({ id: userId, linked: link.linked });
      })
      .catch(() => {
        if (!stop) setLinkState({ id: userId, linked: false });
      });
    return () => {
      stop = true;
    };
  }, [userId]);

  const known = linkState?.id === userId ? linkState.linked : null;
  const registered = Boolean(userId) && known === true;
  const checking = Boolean(userId) && known === null;

  return (
    <header className="site-header sticky top-0 z-40 bg-ink">
      <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 text-white no-underline">
        <AviatorBrandMark className="brand-mark header-plane-mark" />
        <span className="truncate text-sm leading-none font-black tracking-tight italic sm:text-base">
          CASINO <span className="text-red">ROOM</span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {!mounted || checking || (isPending && !userId) ? (
          <div className="h-9 w-16 animate-pulse rounded-full bg-white/10 sm:w-24" aria-hidden />
        ) : registered ? (
          <div className="text-white">
            <UserButton />
          </div>
        ) : (
          <>
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-full border border-white/30 px-3 text-xs font-bold text-white no-underline sm:h-10 sm:px-4 sm:text-sm"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="inline-flex h-9 items-center justify-center rounded-full bg-red px-3 text-xs font-bold text-white no-underline sm:h-10 sm:px-4 sm:text-sm"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  );
});
