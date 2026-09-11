import { describe, it, expect } from "vitest";
import { extractPaymentUrl, extractSlotLines, mentionsAnyTime } from "@/lib/chatSlots";

const AVAILABILITY = [
  "Available times for Blood Test Panel:",
  "- 2026-09-14: 09:00, 09:30, 10:00, 14:30",
].join("\n");

describe("extractSlotLines", () => {
  it("parses the availability lines the tool returns", () => {
    expect(extractSlotLines(AVAILABILITY)).toEqual([
      { date: "2026-09-14", times: ["09:00", "09:30", "10:00", "14:30"] },
    ]);
  });

  it("returns nothing for text with no availability lines", () => {
    expect(extractSlotLines("That appointment could not be found.")).toEqual([]);
  });
});

describe("extractPaymentUrl", () => {
  it("finds a Stripe checkout link", () => {
    expect(extractPaymentUrl("Payment link: https://checkout.stripe.com/c/pay/cs_test_abc#x")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test_abc#x"
    );
  });

  it("returns null when there is no link", () => {
    expect(extractPaymentUrl("Appointment booked. ID: abc.")).toBeNull();
  });
});

describe("mentionsAnyTime", () => {
  const days = extractSlotLines(AVAILABILITY);

  it("detects a 12-hour time the assistant already committed to", () => {
    expect(
      mentionsAnyTime("The Blood Test Panel is available Monday at 9:00 AM.", days)
    ).toBe(true);
  });

  it("detects an afternoon time written in 12-hour form", () => {
    expect(mentionsAnyTime("Booked for 2:30 PM.", days)).toBe(true);
  });

  it("detects a zero-padded 24-hour time", () => {
    expect(mentionsAnyTime("Your slot is 09:30.", days)).toBe(true);
  });

  it("is false when the assistant is inviting the customer to choose", () => {
    expect(
      mentionsAnyTime("Which time would you like? Please also share your name and email.", days)
    ).toBe(false);
  });
});
