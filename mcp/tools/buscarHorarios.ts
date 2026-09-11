import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAvailableSlots } from "@/lib/availability";
import { getServiceById } from "@/lib/services";

export function registerBuscarHorarios(server: McpServer) {
  server.registerTool(
    "buscar_horarios",
    {
      title: "Search availability",
      description:
        "Lists available appointment times for a service, optionally on a specific date.",
      inputSchema: {
        serviceId: z.string().describe("Service id, for example 'general-checkup'"),
        date: z.string().optional().describe("Specific date in YYYY-MM-DD format (optional)"),
      },
    },
    async ({ serviceId, date }) => {
      const service = await getServiceById(serviceId);
      if (!service) {
        return {
          isError: true,
          content: [{ type: "text", text: `No service found with id "${serviceId}".` }],
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
                text: `No times are available for ${service.name}${date ? ` on ${date}` : ""}.`,
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
            { type: "text", text: `Available times for ${service.name}:\n${lines.join("\n")}` },
          ],
        };
      } catch (error) {
        console.error("[mcp/buscar_horarios] failed to compute availability", error);
        return {
          isError: true,
          content: [
            { type: "text", text: "Availability could not be calculated right now." },
          ],
        };
      }
    }
  );
}
