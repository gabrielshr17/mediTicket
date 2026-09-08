import { readFile } from "fs/promises";
import path from "path";

export interface ClinicInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  paymentMethods: string[];
  cancellationPolicy: string;
}

let cache: ClinicInfo | null = null;

export async function getClinicInfo(): Promise<ClinicInfo> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "clinic-info.json");
  const raw = await readFile(filePath, "utf-8");
  cache = JSON.parse(raw) as ClinicInfo;
  return cache;
}
