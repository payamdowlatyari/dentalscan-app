"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageSquare, X, Loader2 } from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender: "patient" | "dentist";
  createdAt: string;
}

export default function QuickMessageSidebar({
  threadId,
  scanId,
  patientId,
  open,
  onClose,
}: {
  threadId?: string | null;
  scanId: string | null;
  patientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveThreadId(null);
    setMessages([]);
  }, [scanId, threadId]);

  const ensureThread = useCallback(async () => {
    if (activeThreadId) return activeThreadId;

    if (threadId) {
      setActiveThreadId(threadId);
      return threadId;
    }

    if (!scanId) throw new Error("Missing scanId for messaging thread");

    const threadRes = await fetch("/api/messaging/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, scanId }),
    });
    const threadData = await threadRes.json();
    if (!threadData.ok) throw new Error("Failed to create/find thread");

    const tid = threadData.data.id as string;
    setActiveThreadId(tid);
    return tid;
  }, [activeThreadId, patientId, scanId, threadId]);

  // Fetch messages when thread exists
  const fetchMessages = useCallback(async (tid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messaging?threadId=${tid}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const init = async () => {
      try {
        const tid = await ensureThread();
        fetchMessages(tid);
      } catch (err) {
        console.error("Failed to initialize thread:", err);
      }
    };

    init();
  }, [open, ensureThread, fetchMessages]);

  useEffect(() => {
    if (activeThreadId && open) {
      fetchMessages(activeThreadId);
    }
  }, [activeThreadId, open, fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const tid = await ensureThread();

      const res = await fetch("/api/messaging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: tid,
          content: trimmed,
          sender: "patient",
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setMessages(prev => [...prev, data.data]);
        setInput("");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm h-full bg-zinc-900 border-l border-zinc-800 flex flex-col animate-[slideInRight_200ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-400" />
            <h2 className="text-sm font-semibold">Message Your Clinic</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-zinc-500" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare size={32} className="mx-auto text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">
                Send a message to your dental clinic.
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                They&apos;ll be notified right away.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "patient" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  msg.sender === "patient"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-zinc-800 text-zinc-200 rounded-bl-md"
                }`}>
                {msg.content}
                <div
                  className={`text-[10px] mt-1 ${
                    msg.sender === "patient"
                      ? "text-blue-200/60"
                      : "text-zinc-500"
                  }`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-zinc-800">
          <div className="flex items-end gap-2 bg-zinc-800 rounded-xl px-3 py-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none text-white placeholder-zinc-500 max-h-24"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || (!scanId && !threadId)}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors">
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
