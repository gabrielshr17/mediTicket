import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPendingAppointment, type CreateAppointmentErrorCode } from "@/lib/appointments";

const ERROR_MESSAGES_ES: Record<CreateAppointmentErrorCode, string> = {
  INVALID_INPUT: "Los datos de la reserva no son válidos. Verifica el nombre, correo, fecha y hora.",
  PAST_DATE: "Elige una fecha y hora futuras válidas.",
  SERVICE_NOT_FOUND: "No se encontró el servicio indicado.",
  SLOT_TAKEN: "Ese horario ya fue reservado por otra persona. Elige otro horario.",
};

export function registerAgendarCita(server: McpServer) {
  server.registerTool(
    "agendar_cita",
    {
      title: "Agendar cita",
      description: "Reserva una cita para un servicio en una fecha y hora específicas (sin procesar el pago).",
      inputSchema: {
        serviceId: z.string().describe("ID del servicio a reservar"),
        patientName: z.string().describe("Nombre completo del paciente"),
        patientEmail: z.string().email().describe("Correo electrónico del paciente"),
        date: z.string().describe("Fecha en formato YYYY-MM-DD"),
        time: z.string().describe("Hora en formato HH:mm"),
      },
    },
    async (input) => {
      const result = await createPendingAppointment(input);

      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: ERROR_MESSAGES_ES[result.code] }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Cita reservada. ID: ${result.appointment.id}. Estado: pendiente de pago. Usa la herramienta link_pago con este ID para completar el pago.`,
          },
        ],
      };
    }
  );
}
