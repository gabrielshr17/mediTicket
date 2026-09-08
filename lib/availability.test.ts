import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services", () => ({
  getServiceById: vi.fn(),
}));
vi.mock("@/lib/businessHours", () => ({
  getBusinessHours: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
    },
  },
}));

import { getServiceById } from "@/lib/services";
import { getBusinessHours } from "@/lib/businessHours";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";

const BUSINESS_HOURS = {
  openDays: [1, 2, 3, 4, 5],
  openTime: "09:00",
  closeTime: "17:00",
  slotIntervalMinutes: 30,
  daysAhead: 14,
};

const SERVICE = {
  id: "general-checkup",
  name: "General Checkup",
  description: "Routine consultation",
  priceCents: 5000,
  durationMinutes: 30,
};

beforeEach(() => {
  vi.mocked(getServiceById).mockResolvedValue(SERVICE);
  vi.mocked(getBusinessHours).mockResolvedValue(BUSINESS_HOURS);
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
});

describe("getAvailableSlots", () => {
  it("returns every interval slot within business hours for an open day with no bookings", async () => {
    const monday = new Date("2024-01-08T00:00:00"); // a Monday

    const slots = await getAvailableSlots(SERVICE.id, { from: monday, days: 1 });

    expect(slots).toEqual([
      { date: "2024-01-08", time: "09:00" },
      { date: "2024-01-08", time: "09:30" },
      { date: "2024-01-08", time: "10:00" },
      { date: "2024-01-08", time: "10:30" },
      { date: "2024-01-08", time: "11:00" },
      { date: "2024-01-08", time: "11:30" },
      { date: "2024-01-08", time: "12:00" },
      { date: "2024-01-08", time: "12:30" },
      { date: "2024-01-08", time: "13:00" },
      { date: "2024-01-08", time: "13:30" },
      { date: "2024-01-08", time: "14:00" },
      { date: "2024-01-08", time: "14:30" },
      { date: "2024-01-08", time: "15:00" },
      { date: "2024-01-08", time: "15:30" },
      { date: "2024-01-08", time: "16:00" },
      { date: "2024-01-08", time: "16:30" },
    ]);
  });

  it("excludes slots that already have a pending or paid appointment", async () => {
    const monday = new Date("2024-01-08T00:00:00");
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { date: "2024-01-08", time: "09:00" },
      { date: "2024-01-08", time: "10:30" },
    ] as Awaited<ReturnType<typeof prisma.appointment.findMany>>);

    const slots = await getAvailableSlots(SERVICE.id, { from: monday, days: 1 });

    expect(slots).not.toContainEqual({ date: "2024-01-08", time: "09:00" });
    expect(slots).not.toContainEqual({ date: "2024-01-08", time: "10:30" });
    expect(slots).toContainEqual({ date: "2024-01-08", time: "09:30" });
    expect(slots).toHaveLength(14);
  });

  it("skips closed days entirely", async () => {
    const saturday = new Date("2024-01-06T00:00:00"); // a Saturday, not in openDays

    const slots = await getAvailableSlots(SERVICE.id, { from: saturday, days: 1 });

    expect(slots).toEqual([]);
  });

  it("throws when the service does not exist", async () => {
    vi.mocked(getServiceById).mockResolvedValue(undefined);

    await expect(getAvailableSlots("unknown-service")).rejects.toThrow("Service not found");
  });
});
