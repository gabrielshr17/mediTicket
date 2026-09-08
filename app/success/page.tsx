"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiClient, type Appointment } from "@/lib/apiClient";

function SuccessContent() {
  const params = useSearchParams();
  const appointmentId = params.get("appointment_id");
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) return;
    ApiClient.getAppointment(appointmentId)
      .then(({ appointment }) => setAppointment(appointment))
      .catch(() => setError("We couldn't load your appointment, but your payment may still have gone through."));
  }, [appointmentId]);

  return (
    <>
      {error && <p className="text-red-600 mt-4">{error}</p>}

      {appointment && (
        <div className="mt-8 rounded-xl bg-white p-6 shadow-sm text-left">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Service</dt>
              <dd className="font-medium">{appointment.serviceName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Date & time</dt>
              <dd className="font-medium">{appointment.date} at {appointment.time}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Patient</dt>
              <dd className="font-medium">{appointment.patientName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium capitalize">{appointment.status}</dd>
            </div>
          </dl>
        </div>
      )}
    </>
  );
}

export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand">Appointment reserved!</h1>
      <p className="text-gray-600 mt-2">
        A confirmation has been sent to your email once payment is verified.
      </p>
      <Suspense fallback={null}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
