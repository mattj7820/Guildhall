import path from "node:path";
import { z } from "zod";
import { JsonFile } from "../data/json-store";

// A date that can't be read is no date, never a file refused.
const fileSchema = z.object({
  version: z.literal(1),
  at: z.iso.datetime({ offset: true }).optional().catch(undefined),
});
type NextSessionFile = z.infer<typeof fileSchema>;

/**
 * When the table next meets, set by the DM, kept in `next-session.json` in the data folder. An
 * instant (ISO 8601, in UTC), so each browser shows it in its own time zone.
 */
export class NextSession {
  constructor(private readonly file: JsonFile<NextSessionFile>) {}

  static inFolder(dataPath: string): NextSession {
    return new NextSession(
      new JsonFile(path.join(dataPath, "next-session.json"), fileSchema, () => ({ version: 1 })),
    );
  }

  async get(): Promise<string | undefined> {
    return (await this.file.read()).at;
  }

  /** Sets the date, or clears it with none. */
  async set(at: Date | undefined): Promise<void> {
    await this.file.update(() => ({
      next: { version: 1 as const, ...(at && { at: at.toISOString() }) },
      result: undefined,
    }));
  }
}
