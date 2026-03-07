"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLATFORMS = ["COURTRESERVE", "PLAYTOMIC", "CUSTOM"] as const;

export function ClubForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    whatsapp_number: "",
    booking_platform: "COURTRESERVE" as (typeof PLATFORMS)[number],
    booking_config: "{}",
    agent_config: "{}",
  });

  function handleNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    setForm((f) => ({ ...f, name, slug }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let booking_config: Record<string, unknown>;
    let agent_config: Record<string, unknown>;

    try {
      booking_config = JSON.parse(form.booking_config);
      agent_config = JSON.parse(form.agent_config);
    } catch {
      setError("Invalid JSON in config fields");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        slug: form.slug,
        whatsapp_number: form.whatsapp_number,
        booking_platform: form.booking_platform,
        booking_config,
        agent_config,
      }),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: unknown };
      setError(JSON.stringify(data.error));
      setLoading(false);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Add Club
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Add Club</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Club Name">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={inputCls}
              placeholder="Green Valley Padel"
            />
          </Field>

          <Field label="Slug">
            <input
              type="text"
              required
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className={inputCls}
              placeholder="green-valley-padel"
            />
          </Field>

          <Field label="WhatsApp Number">
            <input
              type="text"
              required
              value={form.whatsapp_number}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
              className={inputCls}
              placeholder="+15551234567"
            />
          </Field>

          <Field label="Booking Platform">
            <select
              value={form.booking_platform}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  booking_platform: e.target.value as (typeof PLATFORMS)[number],
                }))
              }
              className={inputCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Booking Config (JSON)">
            <textarea
              rows={4}
              value={form.booking_config}
              onChange={(e) => setForm((f) => ({ ...f, booking_config: e.target.value }))}
              className={`${inputCls} font-mono text-xs`}
              placeholder='{"apiKey": "...", "organizationId": "..."}'
            />
          </Field>

          <Field label="Agent Config (JSON)">
            <textarea
              rows={3}
              value={form.agent_config}
              onChange={(e) => setForm((f) => ({ ...f, agent_config: e.target.value }))}
              className={`${inputCls} font-mono text-xs`}
              placeholder='{"courtNames": ["Court 1", "Court 2"], "operatingHours": "8am–10pm"}'
            />
          </Field>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Club"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500";
