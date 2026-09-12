import { describe, it, expect, vi, beforeEach } from "vitest";

const createSession = vi.fn();
const retrieveSession = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: createSession, retrieve: retrieveSession } },
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createCheckoutSessionForAppointment, syncAppointmentPayment } from "@/lib/checkout";

const APPOINTMENT = {
  id: "apt_1",
  serviceId: "general-checkup",
  serviceName: "General Checkup",
  priceCents: 5000,
  durationMinutes: 20,
  patientName: "Jane Doe",
  patientEmail: "jane@example.com",
  date: "2999-01-08",
  time: "10:00",
  status: "pending",
  stripeSessionId: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCheckoutSessionForAppointment", () => {
  it("creates a Stripe Checkout session priced from the appointment and records its id", async () => {
    createSession.mockResolvedValue({ id: "cs_test_123", url: "https://checkout.stripe.com/cs_test_123" });

    const url = await createCheckoutSessionForAppointment(APPOINTMENT, "https://mediticket.example");

    expect(url).toBe("https://checkout.stripe.com/cs_test_123");
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer_email: "jane@example.com",
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "usd",
              unit_amount: 5000,
            }),
            quantity: 1,
          }),
        ],
        metadata: { appointmentId: "apt_1" },
        success_url: expect.stringContaining("https://mediticket.example/success"),
        cancel_url: expect.stringContaining("https://mediticket.example/cancel"),
      })
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "apt_1" },
      data: { stripeSessionId: "cs_test_123" },
    });
  });

  it("throws when Stripe returns no session url", async () => {
    createSession.mockResolvedValue({ id: "cs_test_123", url: null });

    await expect(
      createCheckoutSessionForAppointment(APPOINTMENT, "https://mediticket.example")
    ).rejects.toThrow("Stripe did not return a checkout URL");
  });
});

describe("syncAppointmentPayment", () => {
  it("marks a pending appointment paid when Stripe says the session was paid", async () => {
    const pending = { ...APPOINTMENT, stripeSessionId: "cs_test_123" };
    retrieveSession.mockResolvedValue({ payment_status: "paid" });
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...pending, status: "paid" });

    const result = await syncAppointmentPayment(pending);

    expect(retrieveSession).toHaveBeenCalledWith("cs_test_123");
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: pending.id },
      data: { status: "paid" },
    });
    expect(result.status).toBe("paid");
  });

  it("leaves it pending when Stripe says the session is unpaid", async () => {
    const pending = { ...APPOINTMENT, stripeSessionId: "cs_test_123" };
    retrieveSession.mockResolvedValue({ payment_status: "unpaid" });

    const result = await syncAppointmentPayment(pending);

    expect(result.status).toBe("pending");
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("does not call Stripe for an appointment that is already paid", async () => {
    const result = await syncAppointmentPayment({ ...APPOINTMENT, status: "paid" });

    expect(retrieveSession).not.toHaveBeenCalled();
    expect(result.status).toBe("paid");
  });

  it("does not call Stripe when no checkout session was ever created", async () => {
    const result = await syncAppointmentPayment({ ...APPOINTMENT, stripeSessionId: null });

    expect(retrieveSession).not.toHaveBeenCalled();
    expect(result.status).toBe("pending");
  });

  it("falls back to the stored status when Stripe is unreachable", async () => {
    const pending = { ...APPOINTMENT, stripeSessionId: "cs_test_123" };
    retrieveSession.mockRejectedValue(new Error("stripe is down"));

    const result = await syncAppointmentPayment(pending);

    expect(result.status).toBe("pending");
  });
});
