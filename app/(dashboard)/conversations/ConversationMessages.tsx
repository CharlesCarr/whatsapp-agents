"use client";

import type { Message } from "@/lib/db/types";

interface Props {
  conversation: {
    id: string;
    wa_contact_id: string;
    player_name: string | null;
    clubs: { name: string } | null;
    messages: Message[];
  };
}

export function ConversationMessages({ conversation }: Props) {
  return (
    <>
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-medium text-zinc-900 dark:text-white text-sm">
          {conversation.player_name ?? conversation.wa_contact_id}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{conversation.clubs?.name}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "USER";
  const isTool = message.role === "TOOL";

  if (isTool) {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full font-mono max-w-sm truncate">
          tool: {message.tool_name} → {message.content.slice(0, 60)}
          {message.content.length > 60 ? "..." : ""}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-xs px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-sm"
            : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-tr-sm"
        }`}
      >
        {message.content}
        <div className="text-xs mt-1 opacity-50">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
