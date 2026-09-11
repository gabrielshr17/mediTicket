import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAppointmentById } from "@/lib/appointments";

const STATUS_TEXT: Record<string, string> = {
  pending: "awaiting payment",
  paid: "paid",
};

export function registerConsultarCita(server: McpServer) {
  server.registerTool(
    "consultar_cita",
    {
      title: "Check appointment",
      description:
        "Looks up a booked appointment by its id and reports whether it has been paid. Use this when the customer asks about the status of their booking or says they have already paid.",
      inputSchema: {
        appointmentId: z.string().describe("Appointment id returned by agendar_cita"),
      },
    },
    async ({ appointmentId }) => {
      const appointment = await getAppointmentById(appointmentId);

      if (!appointment) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "That appointment could not be found." }],
        };
      }

      const status = STATUS_TEXT[appointment.status] ?? appointment.status;

      return {
        content: [
          {
            type: "text" as const,
            text: `Appointment ${appointment.id}: ${appointment.serviceName} on ${appointment.date} at ${appointment.time}. Status: ${status}.`,
          },
        ],
      };
    }
  );
}
