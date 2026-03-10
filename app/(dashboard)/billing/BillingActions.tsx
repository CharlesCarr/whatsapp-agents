"use client";

import { useState } from "react";

const STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "";
const GROWTH_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID ?? "";

export function BillingActions({
  clubId,
  hasSubscription,
}: {
  clubId: string;
  hasSubscription: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function subscribe(priceId: string, label: string) {
    setLoading(label);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, priceId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  if (hasSubscription) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-400">
        Active
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => subscribe(STARTER_PRICE_ID, "starter")}
        disabled={loading !== null}
        className="rounded-md bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {loading === "starter" ? "Redirecting…" : "Subscribe Starter ($99/mo)"}
      </button>
      <button
        onClick={() => subscribe(GROWTH_PRICE_ID, "growth")}
        disabled={loading !== null}
        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {loading === "growth" ? "Redirecting…" : "Subscribe Growth ($199/mo)"}
      </button>
    </div>
  );
}
