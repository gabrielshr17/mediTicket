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
  | "MISSING_SERVICE"
  | "MISSING_NAME"
  | "INVALID_EMAIL"
  | "MISSING_DATE"
  | "MISSING_TIME"
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
    typeof time !== "string"
  ) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
      error: "Some booking details are missing.",
    };
  }
  if (!serviceId.trim()) {
    return { ok: false, status: 400, code: "MISSING_SERVICE", error: "Please choose a service." };
  }
  if (!patientName.trim()) {
    return { ok: false, status: 400, code: "MISSING_NAME", error: "Please enter your full name." };
  }
  if (!EMAIL_RE.test(patientEmail)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EMAIL",
      error: "Please enter a valid email address.",
    };
  }
  if (!date) {
    return { ok: false, status: 400, code: "MISSING_DATE", error: "Please choose a date." };
  }
  if (!time) {
    return { ok: false, status: 400, code: "MISSING_TIME", error: "Please choose a time." };
  }

  const appointmentDateTime = new Date(`${date}T${time}`);
  if (Number.isNaN(appointmentDateTime.getTime()) || appointmentDateTime.getTime() < Date.now()) {
    return {
      ok: false,
      status: 400,
      code: "PAST_DATE",
      error: "Please choose a date and time in the future.",
    };
  }

  const service = await getServiceById(serviceId);
  if (!service) {
    return { ok: false, status: 404, code: "SERVICE_NOT_FOUND", error: "That service could not be found." };
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
