import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAvailableSlots } from "@/lib/availability";
import { getServiceById } from "@/lib/services";

export function registerBuscarHorarios(server: McpServer) {
  server.registerTool(
    "buscar_horarios",
    {
      title: "Buscar horarios",
      description:
        "Muestra los horarios disponibles para un servicio, opcionalmente en una fecha específica.",
      inputSchema: {
        serviceId: z.string().describe("ID del servicio, por ejemplo 'general-checkup'"),
        date: z.string().optional().describe("Fecha específica en formato YYYY-MM-DD (opcional)"),
      },
    },
    async ({ serviceId, date }) => {
      const service = await getServiceById(serviceId);
      if (!service) {
        return {
          isError: true,
          content: [{ type: "text", text: `No se encontró el servicio "${serviceId}".` }],
        };
      }

      try {
        const slots = date
          ? (await getAvailableSlots(serviceId, { from: new Date(`${date}T00:00:00`), days: 1 })).filter(
              (slot) => new Date(`${slot.date}T${slot.time}`) > new Date()
            )
          : await getAvailableSlots(serviceId);

        if (slots.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No hay horarios disponibles para ${service.name}${date ? ` el ${date}` : ""}.`,
              },
            ],
          };
        }

        const byDate = new Map<string, string[]>();
        for (const slot of slots) {
          const times = byDate.get(slot.date) ?? [];
          times.push(slot.time);
          byDate.set(slot.date, times);
        }
        const lines = [...byDate.entries()].map(([d, times]) => `- ${d}: ${times.join(", ")}`);

        return {
          content: [
            { type: "text", text: `Horarios disponibles para ${service.name}:\n${lines.join("\n")}` },
          ],
        };
      } catch (error) {
        console.error("[mcp/buscar_horarios] failed to compute availability", error);
        return {
          isError: true,
          content: [
            { type: "text", text: "No se pudieron calcular los horarios disponibles en este momento." },
          ],
        };
      }
    }
  );
}
