export interface SlotDay {
  date: string;
  times: string[];
}

export function extractPaymentUrl(text: string): string | null {
  const match = text.match(/https:\/\/checkout\.stripe\.com\S*/);
  return match ? match[0] : null;
}

export function extractSlotLines(text: string): SlotDay[] {
  return text
    .split("\n")
    .map((line) => line.match(/^- (\d{4}-\d{2}-\d{2}): (.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ date: match[1], times: match[2].split(", ") }));
}

function timeVariants(time: string): string[] {
  const [hours, minutes] = time.split(":");
  const hour24 = Number(hours);
  const hour12 = hour24 % 12 || 12;
  return [time, `${hour24}:${minutes}`, `${hour12}:${minutes}`];
}

export function mentionsAnyTime(text: string, days: SlotDay[]): boolean {
  return days.some((day) =>
    day.times.some((time) => timeVariants(time).some((variant) => text.includes(variant)))
  );
}
