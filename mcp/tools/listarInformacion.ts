import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClinicInfo } from "@/lib/clinicInfo";
import { getServices } from "@/lib/services";

export function registerListarInformacion(server: McpServer) {
  server.registerTool(
    "listar_informacion",
    {
      title: "Listar información",
      description: "Ofrece información general de la clínica y el catálogo de servicios disponibles.",
      inputSchema: {},
    },
    async () => {
      const [info, services] = await Promise.all([getClinicInfo(), getServices()]);

      const serviceLines = services.map(
        (s) => `- ${s.name} (${s.durationMinutes} min, $${(s.priceCents / 100).toFixed(2)}): ${s.description}`
      );

      const text = [
        info.name,
        `Dirección: ${info.address}`,
        `Teléfono: ${info.phone}`,
        `Correo: ${info.email}`,
        `Horario de atención: ${info.hours}`,
        `Métodos de pago: ${info.paymentMethods.join(", ")}`,
        `Política de cancelación: ${info.cancellationPolicy}`,
        "",
        "Servicios disponibles:",
        ...serviceLines,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
