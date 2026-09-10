import { getServiceById } from "@/lib/services";
import { getBusinessHours } from "@/lib/businessHours";
import { prisma } from "@/lib/prisma";

export interface AvailableSlot {
  date: string;
  time: string;
}

const BOOKED_STATUSES = ["pending", "paid"];

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export async function getAvailableSlots(
  serviceId: string,
  options?: { from?: Date; days?: number }
): Promise<AvailableSlot[]> {
  const service = await getServiceById(serviceId);
  if (!service) {
    throw new Error("Service not found");
  }

  const hours = await getBusinessHours();
  const from = options?.from ?? new Date();
  const days = options?.days ?? hours.daysAhead;

  const openMinutes = parseTimeToMinutes(hours.openTime);
  const closeMinutes = parseTimeToMinutes(hours.closeTime);

  const candidates: AvailableSlot[] = [];
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(from);
    day.setDate(day.getDate() + offset);

    if (!hours.openDays.includes(day.getDay())) continue;

    const dateStr = formatDate(day);
    for (
      let minutes = openMinutes;
      minutes + service.durationMinutes <= closeMinutes;
      minutes += hours.slotIntervalMinutes
    ) {
      const time = minutesToTime(minutes);
      const candidateAt = new Date(`${dateStr}T${time}`);
      if (candidateAt <= from) continue;
      candidates.push({ date: dateStr, time });
    }
  }

  if (candidates.length === 0) return candidates;

  const uniqueDates = [...new Set(candidates.map((c) => c.date))];
  const booked = await prisma.appointment.findMany({
    where: {
      serviceId,
      date: { in: uniqueDates },
      status: { in: BOOKED_STATUSES },
    },
    select: { date: true, time: true },
  });
  const bookedSet = new Set(booked.map((b) => `${b.date}|${b.time}`));

  return candidates.filter((c) => !bookedSet.has(`${c.date}|${c.time}`));
}
