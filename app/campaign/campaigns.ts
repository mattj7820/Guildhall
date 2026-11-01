/** Long enough for any title on a book's cover. */
export const CAMPAIGN_NAME_MAX = 60;

/**
 * The campaign that was there before Guildhall knew about campaigns: its data stays where it
 * always was, and without a folder it is the whole vault.
 */
export const FIRST_CAMPAIGN = "first";

/** A campaign the DM runs: a folder of the vault and Guildhall's own data about it. */
export interface Campaign {
  id: string;
  /** The owner's own words; Guildhall never makes one up. */
  name?: string;
  /** The vault folder that is the campaign, as a vault path. None means the whole vault. */
  folder?: string;
}
