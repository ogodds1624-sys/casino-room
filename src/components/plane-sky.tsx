import { useEffect, useRef } from "react";

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

/**
 * The sky clip is a background. Wait until the page has painted, and skip it
 * on a slow or data-saver connection so the form can load first.
 */
export function PlaneSky() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    const type = connection?.effectiveType;
    const slow = connection?.saveData === true || type === "slow-2g" || type === "2g";
    if (slow) return;

    const start = () => {
      if (!video.isConnected || video.src) return;
      video.src = "/media/plane-sky.mp4";
      void video.play().catch(() => undefined);
    };

    const id = window.setTimeout(start, 400);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="plane-sky" aria-hidden>
      <video ref={ref} className="plane-sky-video" muted loop playsInline preload="none" />
      <div className="plane-sky-shade" />
    </div>
  );
}
