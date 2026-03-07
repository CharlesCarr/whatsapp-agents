"use client";

import { useEffect, useRef, useState } from "react";

interface Club {
  id: string;
  name: string;
  booking_platform: string;
}

interface ChatMessage {
  role: "user" | "agent" | "error";
  text: string;
  ts: Date;
}

// Render WhatsApp-style markdown: **bold**, _italic_, line breaks
function renderText(raw: string) {
  return raw.split("\n").map((line, li, lines) => {
    const segments = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
    return (
      <span key={li}>
        {segments.map((seg, si) => {
          if (seg.startsWith("**") && seg.endsWith("**"))
            return <strong key={si}>{seg.slice(2, -2)}</strong>;
          if (seg.startsWith("_") && seg.endsWith("_"))
            return <em key={si}>{seg.slice(1, -1)}</em>;
          return <span key={si}>{seg}</span>;
        })}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ReadTicks() {
  return (
    <svg className="inline-block w-4 h-3 ml-1 -mb-0.5" viewBox="0 0 18 11" fill="none">
      <path d="M1 5.5L5.5 10L12 1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 5.5L10.5 10L17 1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function TestPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [playerName, setPlayerName] = useState("Charlie");
  const [contactId, setContactId] = useState("+34611111111");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/clubs")
      .then((r) => r.json())
      .then((data: Club[]) => {
        setClubs(data);
        if (data.length > 0) setClubId(data[0]!.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !clubId || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text, ts: new Date() }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, waContactId: contactId, message: text, playerName }),
      });

      const data = await res.json();

      if (data.response) {
        setMessages((prev) => [...prev, { role: "agent", text: data.response, ts: new Date() }]);
      } else if (data.error) {
        setMessages((prev) => [...prev, { role: "error", text: data.error, ts: new Date() }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: String(err), ts: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const selectedClub = clubs.find((c) => c.id === clubId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-xl">

      {/* ── WhatsApp phone chrome ── */}
      <div
        className="flex-1 flex flex-col rounded-2xl overflow-hidden min-h-0 shadow-2xl"
        style={{ border: "1px solid #ccc" }}
      >

        {/* Header */}
        <div
          className="flex items-center gap-3 px-3 py-2 shrink-0"
          style={{ background: "#075e54" }}
        >
          {/* Back arrow */}
          <svg className="w-5 h-5 text-white opacity-80 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>

          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 select-none"
            style={{ background: "#128c7e" }}
          >
            {selectedClub?.name.charAt(0).toUpperCase() ?? "?"}
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-[15px] leading-tight truncate">
              {selectedClub?.name ?? "Select a club"}
            </div>
            <div className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.7)" }}>
              {loading ? "typing..." : "online"}
            </div>
          </div>

          {/* Header icons */}
          <div className="flex items-center gap-4 text-white opacity-80">
            {/* Video call */}
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            {/* Phone */}
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.2 2.47.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"/>
            </svg>
            {/* Three dots */}
            <button onClick={() => setSettingsOpen((v) => !v)}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Settings dropdown (opens from ⋮) */}
        {settingsOpen && (
          <div className="shrink-0 bg-white border-b border-zinc-200 px-4 py-3 flex flex-wrap gap-3 items-end text-sm shadow-sm">
            <div className="flex-1 min-w-32">
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Club</label>
              <select
                value={clubId}
                onChange={(e) => { setClubId(e.target.value); setMessages([]); }}
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-28">
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Player</label>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex-1 min-w-32">
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">WA Contact ID</label>
              <input
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => { setMessages([]); setSettingsOpen(false); }}
              className="text-xs px-3 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors"
            >
              Clear chat
            </button>
          </div>
        )}

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1 min-h-0"
          style={{
            background: "#efeae2",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc7' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {/* "Today" chip */}
          {messages.length > 0 && (
            <div className="flex justify-center mb-2">
              <span
                className="text-[11px] px-3 py-0.5 rounded-full shadow-sm"
                style={{ background: "rgba(225,220,212,0.9)", color: "#6b7280" }}
              >
                Today
              </span>
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <span
                className="text-[12px] px-4 py-2 rounded-lg shadow-sm text-center max-w-[220px]"
                style={{ background: "rgba(255,255,255,0.85)", color: "#6b7280" }}
              >
                Tap ⋮ to configure the club &amp; player, then send a message to test the agent
              </span>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isError = msg.role === "error";

            return (
              <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"} mb-0.5`}>
                <div
                  className="relative max-w-[80%] min-w-[72px]"
                >
                  {/* Bubble tail */}
                  <div
                    className="absolute top-0"
                    style={isUser
                      ? { right: -7, width: 0, height: 0, borderLeft: "8px solid #d9fdd3", borderBottom: "8px solid transparent" }
                      : { left: -7, width: 0, height: 0, borderRight: "8px solid #ffffff", borderBottom: "8px solid transparent" }
                    }
                  />

                  <div
                    className="rounded-lg px-3 pt-1.5 pb-1 shadow-sm text-[14.5px] leading-[1.45]"
                    style={
                      isError
                        ? { background: "#fff3f3", border: "1px solid #fca5a5", color: "#b91c1c" }
                        : isUser
                        ? { background: "#d9fdd3", color: "#111b21" }
                        : { background: "#ffffff", color: "#111b21" }
                    }
                  >
                    {isError
                      ? <span className="font-mono text-xs">{msg.text}</span>
                      : renderText(msg.text)
                    }

                    {/* Time + ticks */}
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[11px]" style={{ color: "#667781" }}>{fmt(msg.ts)}</span>
                      {isUser && <ReadTicks />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start mb-0.5">
              <div className="relative">
                <div
                  className="absolute top-0"
                  style={{ left: -7, width: 0, height: 0, borderRight: "8px solid #ffffff", borderBottom: "8px solid transparent" }}
                />
                <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map((n) => (
                      <span
                        key={n}
                        className="block w-2 h-2 rounded-full animate-bounce"
                        style={{ background: "#8696a0", animationDelay: `${n * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          className="flex items-center gap-2 px-2 py-2 shrink-0"
          style={{ background: "#f0f2f5" }}
        >
          {/* Emoji */}
          <button className="text-zinc-500 hover:text-zinc-700 transition-colors p-1 shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 13.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2.5-4H6.5c-.28 0-.5-.22-.5-.5v-.25C6 9.01 8.69 7 12 7s6 2.01 6 3.75v.25c0 .28-.22.5-.5.5z"/>
            </svg>
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            disabled={loading || !clubId}
            className="flex-1 rounded-full px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50"
            style={{ background: "#ffffff" }}
          />

          {/* Attach */}
          <button className="text-zinc-500 hover:text-zinc-700 transition-colors p-1 shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H9v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S6 2.79 6 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
          </button>

          {/* Send / Mic */}
          <button
            onClick={sendMessage}
            disabled={loading || !clubId}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
            style={{ background: "#075e54" }}
          >
            {input.trim() ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H2c0 4.42 3.07 8.09 7 8.93V21h2v-6.07c3.93-.84 7-4.51 7-8.93h-2c0 4.08-3.06 7.44-7 7.93z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
