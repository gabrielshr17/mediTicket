import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPendingAppointment, type CreateAppointmentErrorCode } from "@/lib/appointments";

const ERROR_MESSAGES: Record<CreateAppointmentErrorCode, string> = {
  INVALID_INPUT: "The booking details are not valid. Check the name, email, date and time.",
  MISSING_SERVICE: "Which service would you like to book?",
  MISSING_NAME: "I need the patient's full name to book this.",
  INVALID_EMAIL: "That email address does not look valid. Please provide a valid one.",
  MISSING_DATE: "Which date would you like?",
  MISSING_TIME: "Which time would you like?",
  PAST_DATE: "Choose a valid date and time in the future.",
  SERVICE_NOT_FOUND: "That service could not be found.",
  SLOT_TAKEN: "That time was just booked by someone else. Choose another time.",
};

export function registerAgendarCita(server: McpServer) {
  server.registerTool(
    "agendar_cita",
    {
      title: "Book appointment",
      description: "Reserves an appointment for a service at a specific date and time (payment is not processed).",
      inputSchema: {
        serviceId: z.string().describe("Id of the service to book"),
        patientName: z.string().describe("Patient full name"),
        patientEmail: z.string().email().describe("Patient email address"),
        date: z.string().describe("Date in YYYY-MM-DD format"),
        time: z.string().describe("Time in HH:mm format"),
      },
    },
    async (input) => {
      const result = await createPendingAppointment(input);

      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: ERROR_MESSAGES[result.code] }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Appointment booked. ID: ${result.appointment.id}. Status: awaiting payment. Use the link_pago tool with this ID to take payment.`,
          },
        ],
      };
    }
  );
}
