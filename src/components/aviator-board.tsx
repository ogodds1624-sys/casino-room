import { memo, useEffect, useId, useRef } from "react";

const HISTORY = ["1.58x", "20.92x", "1.10x", "0.89x", "1.14x", "10.38x", "3.08x", "1.63x", "1.17x"];
const HISTORY_COLORS = ["#5ec8ff", "#e85cff", "#7d8cff", "#c084fc", "#60a5fa", "#f472b6", "#a78bfa", "#38bdf8", "#818cf8"];

function point(t: number) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const x = 36 + clamped * 300;
  const y = 214 - Math.pow(clamped, 1.35) * 150;
  return { x, y };
}

function curvePath(t: number) {
  const steps = 24;
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const p = point((t * i) / steps);
    d += `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
}

function fillPath(t: number) {
  const end = point(t);
  return `${curvePath(t)} L${end.x.toFixed(1)} 222 L36 222 Z`;
}

export const AviatorBoard = memo(function AviatorBoard() {
  const rawId = useId().replace(/:/g, "");
  const rayId = `ray-${rawId}`;
  const fillId = `fill-${rawId}`;
  const oddsRef = useRef<SVGTextElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const strokeRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const rootRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const roundDuration = 42000;
    const finishPause = 1800;
    let visible = true;
    let elapsed = 0;
    let lastFrame = performance.now();
    let frameId = 0;

    const paint = (progress: number) => {
      const multiplier = 1 + progress * 4.99;
      const position = point(progress);
      const ahead = point(Math.min(1, progress + 0.01));
      const tilt = (Math.atan2(ahead.y - position.y, ahead.x - position.x) * 180) / Math.PI * 0.35;

      if (oddsRef.current) oddsRef.current.textContent = `${multiplier.toFixed(2)}x`;
      if (strokeRef.current) strokeRef.current.setAttribute("d", curvePath(progress));
      if (fillRef.current) fillRef.current.setAttribute("d", fillPath(progress));
      if (planeRef.current) {
        planeRef.current.setAttribute(
          "transform",
          `translate(${position.x.toFixed(1)} ${position.y.toFixed(1)}) rotate(${tilt.toFixed(1)})`,
        );
      }
    };

    const step = (now: number) => {
      frameId = requestAnimationFrame(step);
      if (document.hidden || !visible || reducedMotion) {
        lastFrame = now;
        return;
      }

      elapsed += Math.min(50, Math.max(0, now - lastFrame));
      lastFrame = now;
      const cycleDuration = roundDuration + finishPause;
      const roundTime = elapsed % cycleDuration;
      if (roundTime >= roundDuration) {
        paint(1);
      } else {
        const linearProgress = roundTime / roundDuration;
        const progress = 0.5 - Math.cos(Math.PI * linearProgress) / 2;
        paint(progress);
      }
    };

    const root = rootRef.current;
    const observer = root && "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          visible = Boolean(entry?.isIntersecting);
          lastFrame = performance.now();
        })
      : null;

    paint(0);
    if (reducedMotion) return;
    if (observer && root) observer.observe(root);
    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, []);

  return (
    <svg
      ref={rootRef}
      viewBox="0 0 360 225"
      width="360"
      height="225"
      preserveAspectRatio="none"
      className="block h-full w-full"
      style={{ backgroundColor: "#12081f" }}
      role="img"
      aria-label="Live Aviator odds"
    >
      <defs>
        <linearGradient id={rayId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b1d73" />
          <stop offset="55%" stopColor="#1a0d33" />
          <stop offset="100%" stopColor="#0b0614" />
        </linearGradient>
        <linearGradient id={fillId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff2a2a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ff5a6a" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="360" height="225" fill="#1a0d33" />
      <rect width="360" height="225" fill={`url(#${rayId})`} />
      {Array.from({ length: 14 }).map((_, i) => (
        <line
          key={i}
          x1="0"
          y1={20 + i * 28}
          x2="360"
          y2={-40 + i * 18}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="18"
        />
      ))}
      <g>
        {HISTORY.map((item, i) => (
          <text
            key={item}
            x={12 + i * 38}
            y="22"
            fill={HISTORY_COLORS[i]}
            fontSize="8"
            fontWeight="700"
            fontFamily="Inter, sans-serif"
          >
            {item}
          </text>
        ))}
      </g>
      <path ref={fillRef} d={fillPath(0)} fill={`url(#${fillId})`} />
      <path
        ref={strokeRef}
        d={curvePath(0)}
        fill="none"
        stroke="#ff4d6a"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text
        ref={oddsRef}
        x="180"
        y="132"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="48"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
      >
        1.00x
      </text>
      <g ref={planeRef} transform={`translate(${point(0).x} ${point(0).y})`}>
        <g transform="translate(-30 -16)">
          <path d="M6 16 L16 8 L14 16 L16 24 Z" fill="#b00000" />
          <path d="M14 14 C28 10 46 10 58 15 C46 20 28 20 14 16 Z" fill="#ff1f1f" />
          <path d="M24 14 L46 2 L50 7 L30 16 Z" fill="#e10600" />
          <path d="M24 16 L44 26 L40 29 L22 18 Z" fill="#9d0000" />
          <path d="M20 13 L48 13" stroke="#ffd6d6" strokeWidth="1.4" />
          <ellipse cx="40" cy="13" rx="6" ry="3.2" fill="#1c1c1c" />
          <ellipse cx="40" cy="12.2" rx="3" ry="1.4" fill="#7dd3ff" />
          <g>
            <ellipse cx="58" cy="15" rx="1.6" ry="8" fill="#ffe4e4" opacity="0.85" />
          </g>
          <circle cx="58" cy="15" r="2.2" fill="#ff2a2a" />
        </g>
      </g>
    </svg>
  );
});
