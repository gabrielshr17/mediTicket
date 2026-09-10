import { readFile } from "fs/promises";
import path from "path";

export interface BusinessHours {
  openDays: number[];
  openTime: string;
  closeTime: string;
  slotIntervalMinutes: number;
  daysAhead: number;
}

let cache: BusinessHours | null = null;

export async function getBusinessHours(): Promise<BusinessHours> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "business-hours.json");
  const raw = await readFile(filePath, "utf-8");
  cache = JSON.parse(raw) as BusinessHours;
  return cache;
}
