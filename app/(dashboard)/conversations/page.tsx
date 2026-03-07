import { db } from "@/lib/db";
import Link from "next/link";
import { ConversationMessages } from "./ConversationMessages";
import type { Message } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string; id?: string }>;
}) {
  const { clubId, id: selectedId } = await searchParams;

  let listQuery = db
    .from("conversations")
    .select("*, clubs!club_id(name), messages(id, content, role, created_at)")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (clubId) listQuery = listQuery.eq("club_id", clubId);

  const { data: conversations } = await listQuery;

  let selected = null;
  if (selectedId) {
    const { data } = await db
      .from("conversations")
      .select("*, clubs!club_id(name), messages(*)")
      .eq("id", selectedId)
      .single();

    if (data) {
      data.messages = (data.messages as Message[]).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      selected = data;
    }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6">Conversations</h1>

      <div className="flex gap-4 h-[75vh]">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0 overflow-y-auto space-y-2">
          {!conversations?.length && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 p-4">No conversations yet.</p>
          )}
          {conversations?.map((conv) => {
            const msgs = conv.messages as Message[];
            const lastMsg = msgs?.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            const isSelected = conv.id === selectedId;
            const club = conv.clubs as { name: string } | null;

            return (
              <Link
                key={conv.id}
                href={`/conversations?${clubId ? `clubId=${clubId}&` : ""}id=${conv.id}`}
                className={`block p-3 rounded-xl border transition-colors ${
                  isSelected
                    ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <div className={`text-xs font-medium mb-0.5 truncate ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {club?.name}
                </div>
                <div className={`text-sm font-medium truncate ${isSelected ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-white"}`}>
                  {conv.player_name ?? conv.wa_contact_id}
                </div>
                {lastMsg && (
                  <p className={`text-xs mt-1 truncate ${isSelected ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>
                    {lastMsg.content}
                  </p>
                )}
                <div className={`text-xs mt-1 ${isSelected ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>
                  {msgs?.length ?? 0} msg{(msgs?.length ?? 0) !== 1 ? "s" : ""}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Message thread */}
        <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
          {selected ? (
            <ConversationMessages conversation={selected} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
