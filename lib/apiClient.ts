import type { Service } from "@/lib/services";

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
};
