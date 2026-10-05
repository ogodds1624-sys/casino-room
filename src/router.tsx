import { createBrowserHistory, type RouterHistory } from "@tanstack/history";
import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { NAV_DELAY_MS } from "@/lib/press-motion";
import { routeTree } from "./routeTree.gen";

function calmHistory(history: RouterHistory): RouterHistory {
  let timer = 0;
  let pending: (() => void) | null = null;

  const schedule = (run: () => void) => {
    const front = document.body.classList.contains("site-front");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!front || reduce) {
      window.clearTimeout(timer);
      pending = null;
      run();
      return;
    }
    pending = run;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const next = pending;
      pending = null;
      next?.();
    }, NAV_DELAY_MS);
  };

  return new Proxy(history, {
    get(target, prop, receiver) {
      if (prop === "push") {
        return (path: string, state?: unknown, navigateOpts?: { ignoreBlocker?: boolean }) => {
          schedule(() => target.push(path, state, navigateOpts));
        };
      }
      if (prop === "replace") {
        return (path: string, state?: unknown, navigateOpts?: { ignoreBlocker?: boolean }) => {
          schedule(() => target.replace(path, state, navigateOpts));
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultViewTransition: true,
    ...(typeof window === "undefined" ? {} : { history: calmHistory(createBrowserHistory()) }),
  });
}
