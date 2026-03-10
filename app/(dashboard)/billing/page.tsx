import { db } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";
import { BillingActions } from "./BillingActions";

type ClubBillingRow = Pick<
  Database["public"]["Tables"]["clubs"]["Row"],
  "id" | "name" | "is_active" | "stripe_customer_id" | "stripe_subscription_id"
>;

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const { data: clubs } = await db
    .from("clubs")
    .select("id, name, is_active, stripe_customer_id, stripe_subscription_id")
    .order("name");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          Billing
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage subscriptions for each club.
        </p>
      </div>

      {params.success === "1" && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-400">
          Subscription activated successfully.
        </div>
      )}

      {params.canceled === "1" && (
        <div className="rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
          Checkout canceled. No changes were made.
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50">
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Club
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Stripe Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {clubs && clubs.length > 0 ? (
              (clubs as ClubBillingRow[]).map((club) => (
                <tr key={club.id}>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-white">
                    {club.name}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        club.is_active
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {club.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                    {club.stripe_customer_id ?? (
                      <span className="text-zinc-400 dark:text-zinc-600 font-sans">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <BillingActions
                      clubId={club.id}
                      hasSubscription={!!club.stripe_subscription_id}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  No clubs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Plans
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-4 space-y-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              Starter
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              $99
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                /mo
              </span>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Up to 1 club, unlimited bookings
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-4 space-y-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              Growth
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              $199
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                /mo
              </span>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Up to 5 clubs, priority support
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
