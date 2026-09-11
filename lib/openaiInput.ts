import type { ResponseInput } from "openai/resources/responses/responses";

type UnknownRecord = Record<string, unknown>;

function stripParsed(part: unknown): unknown {
  if (typeof part !== "object" || part === null || !("parsed" in part)) return part;
  const { parsed: _parsed, ...rest } = part as UnknownRecord;
  return rest;
}

export function toInputItems(output: readonly unknown[]): ResponseInput {
  return output.map((rawItem) => {
    const { parsed_arguments: _parsedArguments, ...item } = rawItem as UnknownRecord;
    if (Array.isArray(item.content)) {
      return { ...item, content: item.content.map(stripParsed) };
    }
    return item;
  }) as unknown as ResponseInput;
}
