import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAppointmentById } from "@/lib/appointments";
import { createCheckoutSessionForAppointment } from "@/lib/checkout";

export function registerLinkPago(server: McpServer, baseUrl: string) {
  server.registerTool(
    "link_pago",
    {
      title: "Link de pago",
      description: "Genera y envía el link de pago de Stripe para una cita ya reservada.",
      inputSchema: {
        appointmentId: z.string().describe("ID de la cita devuelto por agendar_cita"),
      },
    },
    async ({ appointmentId }) => {
      const appointment = await getAppointmentById(appointmentId);
      if (!appointment) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "No se encontró la cita indicada." }],
        };
      }
      if (appointment.status === "paid") {
        return { content: [{ type: "text" as const, text: "Esta cita ya fue pagada." }] };
      }

      try {
        const url = await createCheckoutSessionForAppointment(appointment, baseUrl);
        return { content: [{ type: "text" as const, text: `Link de pago: ${url}` }] };
      } catch (error) {
        console.error("[mcp/link_pago] failed to create checkout session", error);
        return {
          isError: true,
          content: [{ type: "text" as const, text: "No se pudo generar el link de pago en este momento." }],
        };
      }
    }
  );
}
