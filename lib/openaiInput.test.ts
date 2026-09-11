import { describe, it, expect } from "vitest";
import { toInputItems } from "@/lib/openaiInput";

describe("toInputItems", () => {
  it("strips the SDK-added parsed_arguments the API rejects on echo", () => {
    const output = [
      {
        type: "function_call",
        id: "fc_1",
        call_id: "call_1",
        name: "buscar_horarios",
        arguments: '{"serviceId":"dental-cleaning"}',
        parsed_arguments: { serviceId: "dental-cleaning" },
      },
    ];

    const [item] = toInputItems(output) as unknown as Record<string, unknown>[];

    expect(item).not.toHaveProperty("parsed_arguments");
    expect(item).toEqual({
      type: "function_call",
      id: "fc_1",
      call_id: "call_1",
      name: "buscar_horarios",
      arguments: '{"serviceId":"dental-cleaning"}',
    });
  });

  it("strips the SDK-added parsed field from message content parts", () => {
    const output = [
      {
        type: "message",
        id: "msg_1",
        role: "assistant",
        content: [{ type: "output_text", text: "Here you go", annotations: [], parsed: null }],
      },
    ];

    const [item] = toInputItems(output) as unknown as { content: Record<string, unknown>[] }[];

    expect(item.content[0]).not.toHaveProperty("parsed");
    expect(item.content[0].text).toBe("Here you go");
  });

  it("passes other output items through untouched", () => {
    const reasoning = { type: "reasoning", id: "rs_1", summary: [] };

    const [item] = toInputItems([reasoning]) as unknown as Record<string, unknown>[];

    expect(item).toEqual(reasoning);
  });
});
