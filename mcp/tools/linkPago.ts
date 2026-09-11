import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAppointmentById } from "@/lib/appointments";
import { createCheckoutSessionForAppointment } from "@/lib/checkout";

export function registerLinkPago(server: McpServer, baseUrl: string) {
  server.registerTool(
    "link_pago",
    {
      title: "Payment link",
      description: "Generates the Stripe payment link for an appointment that has already been booked.",
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
      if (appointment.status === "paid") {
        return { content: [{ type: "text" as const, text: "This appointment has already been paid." }] };
      }

      try {
        const url = await createCheckoutSessionForAppointment(appointment, baseUrl);
        return { content: [{ type: "text" as const, text: `Payment link: ${url}` }] };
      } catch (error) {
        console.error("[mcp/link_pago] failed to create checkout session", error);
        return {
          isError: true,
          content: [{ type: "text" as const, text: "The payment link could not be generated right now." }],
        };
      }
    }
  );
}
