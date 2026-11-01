import path from "node:path";
import { z } from "zod";
import { CAMPAIGN_NAME_MAX, FIRST_CAMPAIGN, type Campaign } from "~/campaign/campaigns";
import { newId } from "~/shared/ids";
import { JsonFile } from "../data/json-store";

const nameSchema = z.string().trim().min(1).max(CAMPAIGN_NAME_MAX);
const folderSchema = z.string().min(1).max(500);

const otherSchema = z.object({
  // IDs name the campaign's data folder, so only ones newId() makes are kept.
  id: z.string().regex(/^[0-9a-f]{32}$/),
  name: nameSchema.optional().catch(undefined),
  folder: folderSchema,
});

// Anything that can't be read is left out, never a file refused. The first campaign's name and
// folder stay where they were before there were campaigns, so an older Guildhall still reads them.
const fileSchema = z.object({
  version: z.literal(1),
  name: nameSchema.optional().catch(undefined),
  folder: folderSchema.optional().catch(undefined),
  others: z
    .array(otherSchema.nullable().catch(null))
    .transform((others) => others.filter((other) => other !== null))
    .optional()
    .catch(undefined),
  active: z.string().max(40).optional().catch(undefined),
});
type CampaignFile = z.infer<typeof fileSchema>;

/** Why a campaign couldn't be added or changed. */
export type CampaignProblem = "folder-taken" | "unknown";

/**
 * The DM's campaigns, kept in `campaign.json` in the data folder: each a name and a vault folder,
 * and which one the app is running. The first is the campaign that was there before Guildhall
 * knew about campaigns.
 */
export class Campaigns {
  constructor(private readonly file: JsonFile<CampaignFile>) {}

  static inFolder(dataPath: string): Campaigns {
    return new Campaigns(
      new JsonFile(path.join(dataPath, "campaign.json"), fileSchema, () => ({ version: 1 })),
    );
  }

  /** Every campaign, the first first. */
  async list(): Promise<Campaign[]> {
    return campaignsIn(await this.file.read());
  }

  /** The campaign the app is running: the first, unless the DM picked another that's still there. */
  async active(): Promise<Campaign> {
    const file = await this.file.read();
    const all = campaignsIn(file);
    return all.find((campaign) => campaign.id === file.active) ?? all[0];
  }

  /** A new campaign in a folder no other campaign has. */
  async add(name: string, folder: string): Promise<Campaign | CampaignProblem> {
    return this.file.update<Campaign | CampaignProblem>((file) => {
      if (campaignsIn(file).some((campaign) => campaign.folder === folder)) {
        return { next: file, result: "folder-taken" as const };
      }
      const campaign = { id: newId(), ...named(name), folder };
      return { next: { ...file, others: [...(file.others ?? []), campaign] }, result: campaign };
    });
  }

  /** Renames a campaign (trimmed, cut to fit a cover); an empty name clears it. */
  async rename(id: string, name: string): Promise<CampaignProblem | undefined> {
    return this.change(id, (campaign) => ({ ...withoutName(campaign), ...named(name) }));
  }

  /**
   * Moves a campaign to another folder. Only the first may have none (the whole vault), and no
   * two share one.
   */
  async setFolder(id: string, folder: string): Promise<CampaignProblem | undefined> {
    if (!folder && id !== FIRST_CAMPAIGN) return "unknown";
    return this.file.update((file) => {
      if (folder && campaignsIn(file).some((other) => other.folder === folder && other.id !== id)) {
        return { next: file, result: "folder-taken" as const };
      }
      return this.changed(file, id, ({ folder: _old, ...campaign }) => ({
        ...campaign,
        ...(folder && { folder }),
      }));
    });
  }

  /** Makes a campaign the one the app is running. */
  async activate(id: string): Promise<CampaignProblem | undefined> {
    return this.file.update((file) => {
      if (!campaignsIn(file).some((campaign) => campaign.id === id)) {
        return { next: file, result: "unknown" as const };
      }
      const { active: _old, ...rest } = file;
      return { next: id === FIRST_CAMPAIGN ? rest : { ...rest, active: id }, result: undefined };
    });
  }

  private change(id: string, edit: (campaign: Campaign) => Campaign) {
    return this.file.update((file) => this.changed(file, id, edit));
  }

  private changed(
    file: CampaignFile,
    id: string,
    edit: (campaign: Campaign) => Campaign,
  ): { next: CampaignFile; result: CampaignProblem | undefined } {
    if (id === FIRST_CAMPAIGN) {
      const { name: _name, folder: _folder, ...rest } = file;
      const { name, folder } = edit(firstOf(file));
      return {
        next: { ...rest, ...(name && { name }), ...(folder && { folder }) },
        result: undefined,
      };
    }
    const others = file.others ?? [];
    const index = others.findIndex((other) => other.id === id);
    if (index < 0) return { next: file, result: "unknown" };
    const edited = edit(others[index]);
    if (!edited.folder) return { next: file, result: "unknown" };
    const next = others.map((other, at) =>
      at === index ? { ...edited, folder: edited.folder! } : other,
    );
    return { next: { ...file, others: next }, result: undefined };
  }
}

function campaignsIn(file: CampaignFile): Campaign[] {
  return [firstOf(file), ...(file.others ?? [])];
}

function firstOf({ name, folder }: CampaignFile): Campaign {
  return { id: FIRST_CAMPAIGN, ...(name && { name }), ...(folder && { folder }) };
}

function named(name: string): { name?: string } {
  const trimmed = name.trim().slice(0, CAMPAIGN_NAME_MAX).trim();
  return trimmed ? { name: trimmed } : {};
}

function withoutName({ name: _name, ...campaign }: Campaign): Campaign {
  return campaign;
}
