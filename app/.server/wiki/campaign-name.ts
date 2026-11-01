import path from "node:path";
import { z } from "zod";
import { JsonFile } from "../data/json-store";

/** Long enough for any title on a book's cover. */
export const CAMPAIGN_NAME_MAX = 60;

// A name that can't be read is no name, never a file refused.
const fileSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(CAMPAIGN_NAME_MAX).optional().catch(undefined),
});
type CampaignNameFile = z.infer<typeof fileSchema>;

/**
 * The campaign's name, set by the DM on the tome's cover, kept in `campaign.json` in the data
 * folder. It's the owner's own words; Guildhall never makes one up.
 */
export class CampaignName {
  constructor(private readonly file: JsonFile<CampaignNameFile>) {}

  static inFolder(dataPath: string): CampaignName {
    return new CampaignName(
      new JsonFile(path.join(dataPath, "campaign.json"), fileSchema, () => ({ version: 1 })),
    );
  }

  async get(): Promise<string | undefined> {
    return (await this.file.read()).name;
  }

  /** Sets the name (trimmed), or clears it when empty. */
  async set(name: string): Promise<void> {
    const trimmed = name.trim().slice(0, CAMPAIGN_NAME_MAX);
    await this.file.update(() => ({
      next: { version: 1 as const, ...(trimmed && { name: trimmed }) },
      result: undefined,
    }));
  }
}
