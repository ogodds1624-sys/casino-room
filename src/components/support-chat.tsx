import { useLiveStorefront } from "@/lib/storefront-live";

export function SupportChat() {
  const store = useLiveStorefront();
  const whatsapp = store?.whatsapp ?? "";

  if (!whatsapp) return null;

  return (
    <a
      href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Text us")}`}
      target="_blank"
      rel="noreferrer"
      className="wa-float fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 rounded-full bg-[#25D366] px-4 py-3 text-sm font-extrabold text-white no-underline shadow-lg"
    >
      WhatsApp
    </a>
  );
}
