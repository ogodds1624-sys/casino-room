import { Check } from "lucide-react";

/** Visual confirmation only. The animation does not change the route. */
export function TaskSuccess({
  title,
  message,
  ready,
  onContinue,
}: {
  title: string;
  message: string;
  ready: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="relative z-10 w-full max-w-md rounded-[28px] border border-white/10 bg-black/55 px-6 py-12 text-center text-white">
      <div className="mark-pop mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-b from-[#4ade80] to-[#16a34a] shadow-[0_8px_16px_rgba(22,163,74,0.35)]">
        <Check className="size-9 text-white" strokeWidth={3} aria-hidden />
      </div>
      <h1 className="mt-8 text-2xl leading-tight font-extrabold tracking-tight">{title}</h1>
      <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/70">{message}</p>
      <button
        type="button"
        disabled={!ready}
        onClick={onContinue}
        className="mt-8 h-12 w-full rounded-xl bg-red text-base font-extrabold text-white disabled:opacity-60"
      >
        Continue
      </button>
    </section>
  );
}
