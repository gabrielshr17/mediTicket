import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClinicInfo } from "@/lib/clinicInfo";
import { getServices } from "@/lib/services";

export function registerListarInformacion(server: McpServer) {
  server.registerTool(
    "listar_informacion",
    {
      title: "Clinic information",
      description: "Provides general clinic information and the catalogue of available services.",
      inputSchema: {},
    },
    async () => {
      const [info, services] = await Promise.all([getClinicInfo(), getServices()]);

      const serviceLines = services.map(
        (s) => `- ${s.name} (${s.durationMinutes} min, $${(s.priceCents / 100).toFixed(2)}): ${s.description}`
      );

      const text = [
        info.name,
        `Address: ${info.address}`,
        `Phone: ${info.phone}`,
        `Email: ${info.email}`,
        `Opening hours: ${info.hours}`,
        `Payment methods: ${info.paymentMethods.join(", ")}`,
        `Cancellation policy: ${info.cancellationPolicy}`,
        "",
        "Available services:",
        ...serviceLines,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
