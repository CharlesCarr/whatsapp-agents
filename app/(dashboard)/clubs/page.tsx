"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ClubForm, type ClubInitialValues } from "./ClubForm";

interface WhatsAppGroup {
  id: string;
}

interface Club {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  booking_platform: "COURTRESERVE" | "PLAYTOMIC" | "CUSTOM";
  booking_config: Record<string, unknown>;
  agent_config: Record<string, unknown>;
  is_active: boolean;
  whatsapp_groups: WhatsAppGroup[];
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClub, setEditingClub] = useState<ClubInitialValues | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchClubs = useCallback(async () => {
    const res = await fetch("/api/clubs");
    if (res.ok) {
      const data = (await res.json()) as Club[];
      setClubs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchClubs();
  }, [fetchClubs]);

  async function handleToggleActive(club: Club) {
    setTogglingId(club.id);
    const newActive = !club.is_active;

    // Optimistic update
    setClubs((prev) =>
      prev.map((c) => (c.id === club.id ? { ...c, is_active: newActive } : c))
    );

    const res = await fetch(`/api/clubs/${club.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: newActive }),
    });

    if (!res.ok) {
      // Revert on failure
      setClubs((prev) =>
        prev.map((c) =>
          c.id === club.id ? { ...c, is_active: club.is_active } : c
        )
      );
    }

    setTogglingId(null);
  }

  function handleEditClick(club: Club) {
    setEditingClub({
      id: club.id,
      name: club.name,
      slug: club.slug,
      whatsapp_number: club.whatsapp_number,
      booking_platform: club.booking_platform,
      booking_config: club.booking_config,
      agent_config: club.agent_config,
    });
  }

  function handleEditClose() {
    setEditingClub(null);
    void fetchClubs();
  }

  if (loading) {
    return (
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Clubs</h1>
        </div>
        <div className="text-sm text-zinc-400 dark:text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Clubs</h1>
        <ClubForm />
      </div>

      {editingClub && (
        <ClubForm initialValues={editingClub} onClose={handleEditClose} />
      )}

      {!clubs.length ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            No clubs yet. Add your first club to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {club.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      club.is_active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {club.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 space-y-0.5">
                  <div>
                    Platform:{" "}
                    <span className="font-mono text-xs">{club.booking_platform}</span>
                  </div>
                  <div>WA: {club.whatsapp_number}</div>
                  <div>
                    {Array.isArray(club.whatsapp_groups)
                      ? club.whatsapp_groups.length
                      : 0}{" "}
                    group
                    {(Array.isArray(club.whatsapp_groups)
                      ? club.whatsapp_groups.length
                      : 0) !== 1
                      ? "s"
                      : ""}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap justify-end">
                <Link
                  href={`/conversations?clubId=${club.id}`}
                  className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                >
                  View conversations
                </Link>
                <button
                  type="button"
                  onClick={() => handleEditClick(club)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleActive(club)}
                  disabled={togglingId === club.id}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                    club.is_active
                      ? "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                  }`}
                >
                  {togglingId === club.id
                    ? "..."
                    : club.is_active
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
