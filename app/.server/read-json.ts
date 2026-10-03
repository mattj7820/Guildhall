import type { z } from "zod";

/**
 * A JSON request body checked against a schema. A body that isn't JSON at all fails the same way
 * as one that doesn't match, so a route answers both with its usual 400 rather than a 500.
 */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.ZodSafeParseResult<z.output<T>>> {
  const json: unknown = await request.json().catch(() => undefined);
  return schema.safeParse(json);
}
