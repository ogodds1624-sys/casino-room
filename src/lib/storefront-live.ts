import { useEffect, useState } from "react";
import { getStorefront, type Storefront } from "@/lib/admin-snapshot";

const KEY = "aviator-gateway-rev";

export function bumpGateway() {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Preview storage can be blocked. The poll still picks up the save.
  }
  window.dispatchEvent(new Event("aviator-gateway"));
}

function sameStore(current: Storefront, next: Storefront) {
  return JSON.stringify(current) === JSON.stringify(next);
}

export function useLiveStorefront() {
  const [store, setStore] = useState<Storefront | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => {
      void getStorefront({ data: { rev: Date.now() } })
        .then((next) => {
          if (!live) return;
          setStore((current) => (current && sameStore(current, next) ? current : next));
        })
        .catch(() => undefined);
    };
    load();
    const phone = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      load();
    }, phone ? 12000 : 3000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) load();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("aviator-gateway", load);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("aviator-gateway", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  return store;
}
