import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/services", () => ({
  getServiceById: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { getServiceById } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { createPendingAppointment, getAppointmentById } from "@/lib/appointments";

const SERVICE = {
  id: "general-checkup",
  name: "General Checkup",
  description: "Routine consultation",
  priceCents: 5000,
  durationMinutes: 20,
};

const VALID_INPUT = {
  serviceId: SERVICE.id,
  patientName: "Jane Doe",
  patientEmail: "jane@example.com",
  date: "2999-01-08",
  time: "10:00",
};

function makeAppointment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "apt_1",
    serviceId: SERVICE.id,
    serviceName: SERVICE.name,
    priceCents: SERVICE.priceCents,
    durationMinutes: SERVICE.durationMinutes,
    patientName: "Jane Doe",
    patientEmail: "jane@example.com",
    date: "2999-01-08",
    time: "10:00",
    status: "pending",
    stripeSessionId: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServiceById).mockResolvedValue(SERVICE);
});

describe("createPendingAppointment", () => {
  it("creates a pending appointment for a valid, future, known service", async () => {
    const created = makeAppointment();
    vi.mocked(prisma.appointment.create).mockResolvedValue(created);

    const result = await createPendingAppointment(VALID_INPUT);

    expect(result).toEqual({ ok: true, appointment: created });
    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: {
        serviceId: SERVICE.id,
        serviceName: SERVICE.name,
        priceCents: SERVICE.priceCents,
        durationMinutes: SERVICE.durationMinutes,
        patientName: "Jane Doe",
        patientEmail: "jane@example.com",
        date: "2999-01-08",
        time: "10:00",
        status: "pending",
      },
    });
  });

  it("rejects an invalid email without hitting the database", async () => {
    const result = await createPendingAppointment({ ...VALID_INPUT, patientEmail: "not-an-email" });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      error: "Invalid booking details",
    });
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("rejects a date/time in the past", async () => {
    const result = await createPendingAppointment({ ...VALID_INPUT, date: "2000-01-08" });

    expect(result).toEqual({
      ok: false,
      status: 400,
      code: "PAST_DATE",
      error: "Please choose a valid future date and time",
    });
  });

  it("rejects an unknown service", async () => {
    vi.mocked(getServiceById).mockResolvedValue(undefined);

    const result = await createPendingAppointment(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      status: 404,
      code: "SERVICE_NOT_FOUND",
      error: "Service not found",
    });
  });

  it("returns 409 when the slot was just taken (unique constraint violation)", async () => {
    vi.mocked(prisma.appointment.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.20.0",
      })
    );

    const result = await createPendingAppointment(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: "SLOT_TAKEN",
      error: "That slot was just booked by someone else. Please pick another time.",
    });
  });
});

describe("getAppointmentById", () => {
  it("returns the appointment when found", async () => {
    const appointment = makeAppointment({ status: "paid" });
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(appointment);

    const result = await getAppointmentById("apt_1");

    expect(result).toEqual(appointment);
    expect(prisma.appointment.findUnique).toHaveBeenCalledWith({ where: { id: "apt_1" } });
  });

  it("returns null when not found", async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null);

    const result = await getAppointmentById("missing");

    expect(result).toBeNull();
  });
});
