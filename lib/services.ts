import { readFile } from "fs/promises";
import path from "path";

export interface Service {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
}

let cache: Service[] | null = null;

export async function getServices(): Promise<Service[]> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "services.json");
  const raw = await readFile(filePath, "utf-8");
  cache = JSON.parse(raw) as Service[];
  return cache;
}

export async function getServiceById(id: string): Promise<Service | undefined> {
  const services = await getServices();
  return services.find((service) => service.id === id);
}
