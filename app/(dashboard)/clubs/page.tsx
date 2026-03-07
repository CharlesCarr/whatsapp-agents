import { db } from "@/lib/db";
import Link from "next/link";
import { ClubForm } from "./ClubForm";

export const dynamic = "force-dynamic";

export default async function ClubsPage() {
  const { data: clubs } = await db
    .from("clubs")
    .select("*, whatsapp_groups(*)")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Clubs</h1>
        <ClubForm />
      </div>

      {!clubs?.length ? (
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
                  <span className="font-medium text-zinc-900 dark:text-white">{club.name}</span>
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
                    {Array.isArray(club.whatsapp_groups) ? club.whatsapp_groups.length : 0} group
                    {(Array.isArray(club.whatsapp_groups) ? club.whatsapp_groups.length : 0) !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/conversations?clubId=${club.id}`}
                  className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                >
                  View conversations
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
