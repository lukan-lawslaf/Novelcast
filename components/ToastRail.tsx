"use client";

import { useEffect } from "react";
import { useNovelCastStore } from "@/lib/store";

export function ToastRail() {
  const toasts = useNovelCastStore((state) => state.toasts);
  const dismissToast = useNovelCastStore((state) => state.dismissToast);

  useEffect(() => {
    const timers = toasts.map((toast) => window.setTimeout(() => dismissToast(toast.id), 4200));
    return () => timers.forEach(window.clearTimeout);
  }, [dismissToast, toasts]);

  return (
    <div className="fixed right-5 top-5 z-50 flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismissToast(toast.id)}
          className={`rounded-md border px-4 py-3 text-left text-sm shadow-2xl backdrop-blur ${
            toast.tone === "error"
              ? "border-red-300/30 bg-red-950/80 text-red-100"
              : toast.tone === "success"
                ? "border-emerald-300/30 bg-emerald-950/80 text-emerald-100"
                : "border-paper/20 bg-ink/90 text-paper"
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
