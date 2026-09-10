import { Prisma, type Appointment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServiceById } from "@/lib/services";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BookingInput {
  serviceId: string;
  patientName: string;
  patientEmail: string;
  date: string;
  time: string;
}

export type CreateAppointmentErrorCode =
  | "INVALID_INPUT"
  | "PAST_DATE"
  | "SERVICE_NOT_FOUND"
  | "SLOT_TAKEN";

export type CreateAppointmentResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; status: number; code: CreateAppointmentErrorCode; error: string };

export async function createPendingAppointment(
  input: BookingInput
): Promise<CreateAppointmentResult> {
  const { serviceId, patientName, patientEmail, date, time } = input;

  if (
    typeof serviceId !== "string" ||
    typeof patientName !== "string" ||
    typeof patientEmail !== "string" ||
    typeof date !== "string" ||
    typeof time !== "string" ||
    !patientName.trim() ||
    !EMAIL_RE.test(patientEmail) ||
    !date ||
    !time
  ) {
    return { ok: false, status: 400, code: "INVALID_INPUT", error: "Invalid booking details" };
  }

  const appointmentDateTime = new Date(`${date}T${time}`);
  if (Number.isNaN(appointmentDateTime.getTime()) || appointmentDateTime.getTime() < Date.now()) {
    return {
      ok: false,
      status: 400,
      code: "PAST_DATE",
      error: "Please choose a valid future date and time",
    };
  }

  const service = await getServiceById(serviceId);
  if (!service) {
    return { ok: false, status: 404, code: "SERVICE_NOT_FOUND", error: "Service not found" };
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        serviceId: service.id,
        serviceName: service.name,
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes,
        patientName: patientName.trim(),
        patientEmail: patientEmail.trim(),
        date,
        time,
        status: "pending",
      },
    });
    return { ok: true, appointment };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        status: 409,
        code: "SLOT_TAKEN",
        error: "That slot was just booked by someone else. Please pick another time.",
      };
    }
    throw error;
  }
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  return prisma.appointment.findUnique({ where: { id } });
}
