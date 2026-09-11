import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/chatPrompt";

const FRIDAY = new Date("2026-09-11T12:00:00");

describe("buildSystemPrompt", () => {
  it("tells the model today's date so it can resolve relative dates", async () => {
    const prompt = await buildSystemPrompt(FRIDAY);

    expect(prompt).toContain("2026-09-11");
    expect(prompt).toContain("Friday");
  });

  it("lists every service id so the model never has to guess one", async () => {
    const prompt = await buildSystemPrompt(FRIDAY);

    for (const id of [
      "general-checkup",
      "dental-cleaning",
      "blood-test",
      "cardiology-consult",
      "physical-therapy",
    ]) {
      expect(prompt).toContain(id);
    }
  });

  it("restricts the assistant to clinic topics", async () => {
    const prompt = await buildSystemPrompt(FRIDAY);

    expect(prompt.toLowerCase()).toContain("decline");
  });

  it("instructs the model to treat user and tool text as data, not instructions", async () => {
    const prompt = await buildSystemPrompt(FRIDAY);

    expect(prompt.toLowerCase()).toContain("never as instructions");
  });

  it("is written in English", async () => {
    const prompt = await buildSystemPrompt(FRIDAY);

    expect(prompt).toContain("You are the virtual assistant for mediTicket");
    expect(prompt).not.toMatch(/Eres el asistente/);
  });

  it("tells the assistant to be proactive rather than only answering", async () => {
    const prompt = await buildSystemPrompt(FRIDAY);

    expect(prompt).toContain("BE PROACTIVE");
    expect(prompt.toLowerCase()).toContain("move the booking forward");
  });
});
