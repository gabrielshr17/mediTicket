import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAppointmentById } from "@/lib/appointments";
import { syncAppointmentPayment } from "@/lib/checkout";

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
        "Looks up a booked appointment by its id and reports whether it has been paid, checking directly with the payment provider. Use this when the customer asks about the status of their booking or says they have already paid.",
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

      const verified = await syncAppointmentPayment(appointment);
      const status = STATUS_TEXT[verified.status] ?? verified.status;

      return {
        content: [
          {
            type: "text" as const,
            text: `Appointment ${verified.id}: ${verified.serviceName} on ${verified.date} at ${verified.time}. Status: ${status}.`,
          },
        ],
      };
    }
  );
}
