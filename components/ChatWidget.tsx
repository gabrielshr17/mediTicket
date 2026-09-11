"use client";

import { useEffect, useRef, useState } from "react";
import { ApiClient } from "@/lib/apiClient";
import type { ChatMessage } from "@/lib/chatEvents";

interface ToolResult {
  tool: string;
  isError: boolean;
  text: string;
}

interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  toolResults: ToolResult[];
}

const GREETING =
  "Hi! I can check appointment availability, answer questions about our services and hours, book you in, and send you a payment link. What would you like to do?";

const SUGGESTIONS = [
  "What services do you offer?",
  "When is the next available appointment?",
  "What are your opening hours?",
];

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.2-3.6A7.96 7.96 0 0 1 4 12Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12l16-8-6 8 6 8-16-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function extractPaymentUrl(text: string): string | null {
  const match = text.match(/https:\/\/checkout\.stripe\.com\S*/);
  return match ? match[0] : null;
}

function extractSlotLines(text: string): { date: string; times: string[] }[] {
  return text
    .split("\n")
    .map((line) => line.match(/^- (\d{4}-\d{2}-\d{2}): (.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ date: match[1], times: match[2].split(", ") }));
}

function ToolResultExtras({
  results,
  onSlotClick,
}: {
  results: ToolResult[];
  onSlotClick: (date: string, time: string) => void;
}) {
  return (
    <>
      {results
        .filter((result) => !result.isError)
        .map((result, i) => {
          const paymentUrl = extractPaymentUrl(result.text);
          if (paymentUrl) {
            return (
              <a
                key={i}
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-brand py-3 text-center font-semibold text-white transition hover:bg-brand-dark"
              >
                Pay now
              </a>
            );
          }

          const days = extractSlotLines(result.text);
          if (days.length > 0) {
            return (
              <div key={i} className="space-y-2">
                {days.map((day) => (
                  <div key={day.date}>
                    <p className="mb-1 text-xs font-medium text-gray-500">{day.date}</p>
                    <div className="flex flex-wrap gap-2">
                      {day.times.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => onSlotClick(day.date, time)}
                          className="rounded-lg border border-brand px-3 py-1.5 text-sm text-brand transition hover:bg-brand/5"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          return null;
        })}
    </>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen && available === null) {
      ApiClient.getChatStatus()
        .then(({ available }) => setAvailable(available))
        .catch(() => setAvailable(false));
    }
  }, [isOpen, available]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    const history = [...messages, { role: "user" as const, text, toolResults: [] }];
    setMessages([...history, { role: "assistant", text: "", toolResults: [] }]);
    setInput("");
    setIsStreaming(true);

    const apiHistory: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.text }));
    const assistantIndex = history.length;

    function updateAssistant(update: (message: DisplayMessage) => DisplayMessage) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIndex] = update(copy[assistantIndex]);
        return copy;
      });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const event of ApiClient.streamChat(apiHistory, controller.signal)) {
        if (event.type === "text") {
          updateAssistant((m) => ({ ...m, text: m.text + event.text }));
        } else if (event.type === "tool_result") {
          updateAssistant((m) => ({
            ...m,
            toolResults: [...m.toolResults, { tool: event.tool, isError: event.isError, text: event.text }],
          }));
        } else if (event.type === "error") {
          updateAssistant((m) => ({ ...m, text: m.text || event.message }));
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        updateAssistant((m) => ({
          ...m,
          text:
            m.text ||
            (error instanceof Error ? error.message : "Could not reach the assistant. Please try again."),
        }));
      }
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    void sendMessage(text);
  }

  function handleSlotClick(date: string, time: string) {
    setInput(`I would like to book ${date} at ${time}.`);
  }

  function closePanel() {
    abortRef.current?.abort();
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (isOpen ? closePanel() : setIsOpen(true))}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand-dark sm:bottom-6 sm:right-6"
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col rounded-t-2xl bg-white shadow-lg sm:inset-x-auto sm:bottom-20 sm:right-6 sm:top-auto sm:h-[32rem] sm:w-96 sm:rounded-2xl sm:border sm:border-gray-200">
          <header className="flex items-center justify-between rounded-t-2xl bg-brand px-4 py-3 text-white">
            <span className="font-semibold">mediTicket Assistant</span>
            <button type="button" onClick={closePanel} aria-label="Close chat">
              <CloseIcon />
            </button>
          </header>

          {available === false ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500">
              The assistant is unavailable right now. You can still book using the form on this page.
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg bg-teal-50 px-3 py-2 text-sm text-gray-900">
                        {GREETING}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          disabled={isStreaming || available === null}
                          onClick={() => void sendMessage(suggestion)}
                          className="rounded-lg border border-brand px-3 py-1.5 text-sm text-brand transition hover:bg-brand/5 disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, i) => (
                  <div key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[80%] space-y-2 rounded-lg px-3 py-2 text-sm ${
                        message.role === "user" ? "bg-brand text-white" : "bg-teal-50 text-gray-900"
                      }`}
                    >
                      {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                      <ToolResultExtras results={message.toolResults} onSlotClick={handleSlotClick} />
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  maxLength={1000}
                  disabled={isStreaming || available === null}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isStreaming || available === null || !input.trim()}
                  aria-label="Send"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
                >
                  <SendIcon />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
