import { z } from "zod";

const emailSchema = z.string().trim().email().max(254);

export function isValidEmail(value: unknown): value is string {
  return emailSchema.safeParse(value).success;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
