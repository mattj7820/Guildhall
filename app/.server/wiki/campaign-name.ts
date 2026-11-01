import path from "node:path";
import { z } from "zod";
import { JsonFile } from "../data/json-store";

/** Long enough for any title on a book's cover. */
export const CAMPAIGN_NAME_MAX = 60;

// Anything that can't be read is left out, never a file refused.
const fileSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(CAMPAIGN_NAME_MAX).optional().catch(undefined),
  folder: z.string().min(1).max(500).optional().catch(undefined),
});
type CampaignFile = z.infer<typeof fileSchema>;

export interface CampaignBook {
  /** The campaign's name, on the tome's cover. */
  name?: string;
  /**
   * The vault folder that is the book (its folders are the tome's chapters), as a vault path.
   * None means the whole vault. Never checked here: a folder that's gone is simply not found.
   */
  folder?: string;
}

/**
 * The campaign's name and which folder is its book, set by the DM on the tome's cover and kept
 * in `campaign.json` in the data folder. The owner's own words; Guildhall never makes one up.
 */
export class CampaignName {
  constructor(private readonly file: JsonFile<CampaignFile>) {}

  static inFolder(dataPath: string): CampaignName {
    return new CampaignName(
      new JsonFile(path.join(dataPath, "campaign.json"), fileSchema, () => ({ version: 1 })),
    );
  }

  async book(): Promise<CampaignBook> {
    const { name, folder } = await this.file.read();
    return { ...(name && { name }), ...(folder && { folder }) };
  }

  async get(): Promise<string | undefined> {
    return (await this.file.read()).name;
  }

  /** Sets the name (trimmed) and the book's folder; empty clears either. */
  async set(name: string, folder = ""): Promise<void> {
    const trimmed = name.trim().slice(0, CAMPAIGN_NAME_MAX);
    await this.file.update(() => ({
      next: { version: 1 as const, ...(trimmed && { name: trimmed }), ...(folder && { folder }) },
      result: undefined,
    }));
  }
}
