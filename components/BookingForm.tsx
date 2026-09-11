"use client";

import { useEffect, useState } from "react";
import { ApiClient } from "@/lib/apiClient";
import type { Service } from "@/lib/services";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function BookingForm() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getServices()
      .then(({ services }) => {
        setServices(services);
        setSelectedServiceId(services[0]?.id ?? "");
      })
      .catch(() => setLoadError("Could not load the list of services. Check your connection and refresh the page."));
  }, []);

  const selectedService = services.find((service) => service.id === selectedServiceId);
  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedServiceId) {
      setSubmitError("Please choose a service.");
      return;
    }
    if (!date) {
      setSubmitError("Please choose a date.");
      return;
    }
    if (!time) {
      setSubmitError("Please choose a time.");
      return;
    }
    if (!patientName.trim()) {
      setSubmitError("Please enter your full name.");
      return;
    }
    if (!patientEmail.trim()) {
      setSubmitError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const { url } = await ApiClient.createCheckoutSession({
        serviceId: selectedServiceId,
        patientName,
        patientEmail,
        date,
        time,
      });
      window.location.href = url;
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  if (loadError) {
    return <p className="text-red-600">{loadError}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">1. Choose a service</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <label
              key={service.id}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                selectedServiceId === service.id
                  ? "border-brand ring-2 ring-brand bg-brand/5"
                  : "border-gray-200 hover:border-brand/50"
              }`}
            >
              <input
                type="radio"
                name="service"
                value={service.id}
                checked={selectedServiceId === service.id}
                onChange={() => setSelectedServiceId(service.id)}
                className="sr-only"
              />
              <p className="font-medium">{service.name}</p>
              <p className="text-sm text-gray-500 mt-1">{service.description}</p>
              <div className="flex justify-between mt-3 text-sm font-medium">
                <span>{formatPrice(service.priceCents)}</span>
                <span className="text-gray-500">{service.durationMinutes} min</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">2. Pick a date & time</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="date"
            required
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">3. Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            required
            placeholder="Full name"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
          <input
            type="email"
            required
            placeholder="Email address"
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </section>

      {submitError && <p className="text-red-600 text-sm">{submitError}</p>}

      <button
        type="submit"
        disabled={loading || !selectedService}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {loading
          ? "Redirecting to payment..."
          : selectedService
          ? `Reserve & Pay ${formatPrice(selectedService.priceCents)}`
          : "Reserve & Pay"}
      </button>
    </form>
  );
}
