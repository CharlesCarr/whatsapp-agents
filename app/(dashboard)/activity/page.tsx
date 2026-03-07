import { db } from "@/lib/db";
import type { Club, BookingActivity } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const ACTION_STYLES: Record<string, string> = {
  BOOKED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  CHECKED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const { clubId } = await searchParams;

  let activityQuery = db
    .from("booking_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (clubId) activityQuery = activityQuery.eq("club_id", clubId);

  const [{ data: activity }, { data: clubs }] = await Promise.all([
    activityQuery,
    db.from("clubs").select("id, name").eq("is_active", true),
  ]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Booking Activity</h1>

        <div className="flex gap-2 text-sm flex-wrap">
          <a
            href="/activity"
            className={`px-3 py-1 rounded-lg ${!clubId ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            All clubs
          </a>
          {(clubs as Club[] | null)?.map((c) => (
            <a
              key={c.id}
              href={`/activity?clubId=${c.id}`}
              className={`px-3 py-1 rounded-lg ${clubId === c.id ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              {c.name}
            </a>
          ))}
        </div>
      </div>

      {!activity?.length ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">No booking activity yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Player</th>
                <th className="px-4 py-3 text-left font-medium">Court</th>
                <th className="px-4 py-3 text-left font-medium">Date / Time</th>
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(activity as BookingActivity[]).map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_STYLES[item.action] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {item.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-white">
                    {item.player_name ?? item.wa_contact_id}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {item.court_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {item.slot_date && item.slot_time ? `${item.slot_date} ${item.slot_time}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {item.booking_ref ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 text-xs">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
