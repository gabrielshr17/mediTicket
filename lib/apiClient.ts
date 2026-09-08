import type { Service } from "@/lib/services";
import type { ChatMessage, ChatStreamEvent } from "@/lib/chatEvents";

export interface Appointment {
  id: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  patientName: string;
  patientEmail: string;
  date: string;
  time: string;
  status: string;
}

export interface BookingInput {
  serviceId: string;
  patientName: string;
  patientEmail: string;
  date: string;
  time: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? "Request failed");
  }

  return data as T;
}

export const ApiClient = {
  getServices: () => request<{ services: Service[] }>("/api/services"),

  getAppointment: (id: string) =>
    request<{ appointment: Appointment }>(`/api/appointments/${id}`),

  createCheckoutSession: (input: BookingInput) =>
    request<{ url: string }>("/api/checkout", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  streamChat: (messages: ChatMessage[], signal?: AbortSignal) => streamChat(messages, signal),

  getChatStatus: () => request<{ available: boolean }>("/api/chat"),
};

async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Chat request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const chunk of events) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      yield JSON.parse(line.slice("data: ".length)) as ChatStreamEvent;
    }
  }
}
